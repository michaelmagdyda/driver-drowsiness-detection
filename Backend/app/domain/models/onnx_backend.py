"""ONNX Runtime detector backend.

Adapter over an end-to-end ONNX export of the project's trained Faster R-CNN
(``ML/export_onnx.py``): backbone, RPN, proposal decode + NMS, RoI Align,
detection head, per-class NMS and top-K score/NMS thresholding are all baked
into the graph. Unlike :class:`~app.domain.models.faster_rcnn.FasterRCNNBackend`,
which builds the network in Python and runs a PyTorch forward pass, this
backend never imports ``torch`` on the inference path - it hands a normalised
tensor to an ``onnxruntime.InferenceSession`` and gets ``boxes``/``labels``/
``scores`` straight back.

The exported graph applies its *own* score threshold internally (baked in at
export time, see ``ONNXFasterRCNN.score_thresh`` in ``export_onnx.py``) - it
cannot be changed without re-exporting the ``.onnx`` file. :attr:`_score_threshold`
here is therefore an *additional* filter applied on top of whatever the graph
already discarded: raising it above the export-time threshold behaves exactly
like the PyTorch backend; lowering it below the export-time threshold cannot
recover detections the graph already dropped.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

from app.core.constants import MODEL_INPUT_SIZE, NUM_FOREGROUND_CLASSES
from app.core.exceptions import InferenceError, ModelNotLoadedError
from app.core.logging import get_logger
from app.domain.models.base import BaseModelBackend, ModelMetadata, RawDetection
from app.domain.models.custom_frcnn._geometry import NORM_MEAN, NORM_STD

if TYPE_CHECKING:
    from pathlib import Path

    import onnxruntime as ort

logger = get_logger(__name__)

_MEAN = np.array(NORM_MEAN, dtype=np.float32).reshape(3, 1, 1)
_STD = np.array(NORM_STD, dtype=np.float32).reshape(3, 1, 1)

# ONNX Runtime provider name -> the short device string ModelMetadata reports.
_PROVIDER_DEVICE_NAMES: dict[str, str] = {
    "CUDAExecutionProvider": "cuda",
    "DmlExecutionProvider": "directml",
    "CPUExecutionProvider": "cpu",
}


def _resolve_providers(requested: str) -> list[str]:
    """Choose ONNX Runtime execution providers for the requested device.

    Args:
        requested: ``"auto"``, ``"cpu"``, ``"cuda"``, ``"gpu"``, or an
            explicit device string such as ``"cuda:0"``.

    Returns:
        An ordered provider list, most-preferred first, always ending in
        ``"CPUExecutionProvider"`` so a GPU request still runs somewhere when
        no GPU provider is installed (a plain-CPU ``onnxruntime`` wheel, or a
        GPU-capable wheel on a host with no compatible GPU/driver - this is
        the normal case in production, which never has a GPU).
    """
    import onnxruntime as ort

    available = set(ort.get_available_providers())
    wants_gpu = requested != "cpu" and (
        requested in ("auto", "gpu") or "cuda" in requested or "dml" in requested
    )
    if not wants_gpu:
        return ["CPUExecutionProvider"]

    # Preference order: CUDA (fastest, Linux/Windows) then DirectML (Windows-
    # only, no separate CUDA/cuDNN toolkit needed - see requirements.txt for
    # the local dev setup note). Only providers actually present in this
    # onnxruntime build's wheel are ever offered to InferenceSession.
    providers = [
        provider
        for provider in ("CUDAExecutionProvider", "DmlExecutionProvider")
        if provider in available
    ]
    providers.append("CPUExecutionProvider")
    return providers


class OnnxFasterRCNNBackend(BaseModelBackend):
    """Trained Faster R-CNN exported to ONNX, loaded once and reused per request.

    Args:
        checkpoint_path: Absolute path to the ``.onnx`` graph.
        device: Requested device string (``"auto"`` by default).
        score_threshold: Minimum detection score to keep, applied on top of
            whatever the graph's own baked-in threshold already discarded.
    """

    architecture = "faster_rcnn_onnx"

    def __init__(
        self,
        checkpoint_path: Path,
        *,
        device: str = "auto",
        score_threshold: float = 0.5,
    ) -> None:
        """Store configuration without touching the graph (see :meth:`load`)."""
        self._checkpoint_path = checkpoint_path
        self._requested_device = device
        self._score_threshold = score_threshold
        self._session: ort.InferenceSession | None = None
        self._input_name: str | None = None
        self._active_provider: str | None = None

    @property
    def checkpoint_path(self) -> Path:
        """The ``.onnx`` graph this backend was constructed to load."""
        return self._checkpoint_path

    def load(self) -> None:
        """Load the ONNX graph and create an inference session.

        Raises:
            ModelNotLoadedError: The graph file is missing or ONNX Runtime
                cannot parse it. The message never includes the filesystem
                path (Frontend Integration §11 forbids leaking it).
        """
        import onnxruntime as ort

        if not self._checkpoint_path.exists():
            logger.error("ONNX model file not found at configured path.")
            raise ModelNotLoadedError("The AI model checkpoint was not found on disk.")

        providers = _resolve_providers(self._requested_device)
        try:
            session = ort.InferenceSession(str(self._checkpoint_path), providers=providers)
        except Exception as error:  # noqa: BLE001 - surfaced as a controlled 503
            logger.exception("Failed to load ONNX model.")
            raise ModelNotLoadedError("The AI model checkpoint could not be loaded.") from error

        self._session = session
        self._input_name = session.get_inputs()[0].name
        self._active_provider = session.get_providers()[0]
        logger.info(
            "AI model loaded (architecture=%s, provider=%s, classes=%d).",
            self.architecture,
            self._active_provider,
            NUM_FOREGROUND_CLASSES,
        )

    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:
        """Run inference on one RGB image.

        Args:
            image_rgb: ``H x W x 3`` uint8 array in RGB order.

        Returns:
            Foreground detections at or above the score threshold, in the
            pixel coordinates of ``image_rgb``.

        Raises:
            ModelNotLoadedError: :meth:`load` has not completed successfully.
            InferenceError: The forward pass failed.
        """
        if self._session is None or self._input_name is None:
            raise ModelNotLoadedError("The AI model is not currently available.")

        original_height, original_width = image_rgb.shape[0], image_rgb.shape[1]
        try:
            tensor = self._to_input_tensor(image_rgb)
            boxes, labels, scores = self._session.run(
                ["boxes", "labels", "scores"], {self._input_name: tensor}
            )
            return self._parse_outputs(boxes, labels, scores, original_width, original_height)
        except ModelNotLoadedError:
            raise
        except Exception as error:  # noqa: BLE001 - surfaced as a controlled 500
            logger.exception("AI inference forward pass failed.")
            raise InferenceError from error

    def _to_input_tensor(self, image_rgb: np.ndarray) -> np.ndarray:
        """Resize and normalise an RGB uint8 array to the tensor the graph expects.

        Mirrors :meth:`FasterRCNNBackend._to_input_tensor` exactly (same fixed
        square resize, same 0.5/0.5 mean/std) so the two backends are
        interchangeable for a given checkpoint.

        Args:
            image_rgb: ``H x W x 3`` uint8 array.

        Returns:
            A ``1 x 3 x MODEL_INPUT_SIZE x MODEL_INPUT_SIZE`` normalised
            ``float32`` array.
        """
        import cv2

        resized = cv2.resize(image_rgb, (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE))
        array = resized.astype(np.float32) / 255.0
        chw = array.transpose(2, 0, 1)
        normalised = (chw - _MEAN) / _STD
        return normalised[np.newaxis, ...].astype(np.float32)

    def _parse_outputs(
        self,
        boxes: np.ndarray,
        labels: np.ndarray,
        scores: np.ndarray,
        original_width: int,
        original_height: int,
    ) -> list[RawDetection]:
        """Convert the graph's model-space outputs to domain detections.

        The graph already applies its own baked-in score threshold and NMS,
        so :attr:`_score_threshold` here only ever narrows the result further
        (see module docstring); this then rescales boxes from
        ``MODEL_INPUT_SIZE`` model space back to the source image's pixel
        coordinates.

        Args:
            boxes: ``D x 4`` ``xyxy`` float array in model space.
            labels: ``D`` int array, foreground class indices (``1..C``).
            scores: ``D`` float array, confidence in ``[0, 1]``.
            original_width: Width of the source image, in pixels.
            original_height: Height of the source image, in pixels.

        Returns:
            Foreground detections in the pixel coordinates of the source image.
        """
        scale_x = original_width / MODEL_INPUT_SIZE
        scale_y = original_height / MODEL_INPUT_SIZE

        detections: list[RawDetection] = []
        for box, label, score in zip(boxes, labels, scores, strict=True):
            if float(score) < self._score_threshold:
                continue
            x1, y1, x2, y2 = (float(value) for value in box)
            detections.append(
                RawDetection(
                    label_index=int(label),
                    score=float(score),
                    x1=x1 * scale_x,
                    y1=y1 * scale_y,
                    x2=x2 * scale_x,
                    y2=y2 * scale_y,
                )
            )
        return detections

    def metadata(self) -> ModelMetadata:
        """Return descriptive metadata for the health endpoints."""
        if self._active_provider is not None:
            device = _PROVIDER_DEVICE_NAMES.get(self._active_provider, "cpu")
        else:
            device = self._requested_device
        return ModelMetadata(
            architecture=self.architecture,
            device=device,
            num_classes=NUM_FOREGROUND_CLASSES,
            score_threshold=self._score_threshold,
        )

    @staticmethod
    def warmup_shape() -> tuple[int, int, int]:
        """Return a representative input shape for an optional warmup pass.

        Returns:
            ``(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3)``.
        """
        return (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3)
