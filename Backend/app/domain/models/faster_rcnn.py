"""Faster R-CNN detector backend.

Adapter over the project's trained, from-scratch Faster R-CNN checkpoint at
``ML/checkpoints/tuned/best.pth``. The weights are three foreground classes
plus background, in the order fixed by :data:`~app.core.constants.MODEL_LABELS`
(``background, closed_eye, open_eye, yawn``).

The checkpoint is a **state dict** nested under a ``"model"`` key
(``torch.save({"model": model.state_dict(), ...})``, per ``ML/inference.py``),
of the project's own from-scratch network - a custom CNN backbone, hand-built
RPN and RoI head (see ``ML/models/faster_rcnn.py``) - not a torchvision
``fasterrcnn_resnet50_fpn``. :mod:`app.domain.models.custom_frcnn` is a
vendored, inference-only port of that architecture (the training repo is not
available at runtime - ``Dockerfile.ml`` only copies ``app/``). This module
resizes/normalises input the way the custom network expects (fixed
``MODEL_INPUT_SIZE`` square, mean/std 0.5) and rescales its output boxes back
to the source image, since - unlike torchvision detection models - the custom
network has no built-in resize.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

import numpy as np

from app.core.constants import MODEL_INPUT_SIZE, NUM_FOREGROUND_CLASSES
from app.core.exceptions import InferenceError, ModelNotLoadedError
from app.core.logging import get_logger
from app.domain.models.base import BaseModelBackend, ModelMetadata, RawDetection
from app.domain.models.custom_frcnn._geometry import NORM_MEAN, NORM_STD

if TYPE_CHECKING:
    from pathlib import Path

    import torch

logger = get_logger(__name__)


def _resolve_device(requested: str) -> torch.device:
    """Choose the torch device to run on.

    Args:
        requested: ``"auto"``, ``"cpu"``, ``"cuda"``, or an explicit device
            string such as ``"cuda:0"``.

    Returns:
        A concrete :class:`torch.device`. ``"auto"`` resolves to CUDA when a GPU
        is visible and CPU otherwise, so the same configuration runs on a
        developer laptop and a GPU host without editing.
    """
    import torch

    if requested == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return torch.device(requested)


def _build_model(score_threshold: float) -> torch.nn.Module:
    """Construct the model architecture that the checkpoint's weights fit.

    Only used for the *state dict* checkpoint path.

    Args:
        score_threshold: Minimum per-class score the detection head keeps,
            baked into the module because the custom network's RoI head
            post-processing (NMS, thresholding) runs inside its own forward
            pass rather than being applied by the caller afterwards.

    Returns:
        An un-loaded :class:`torch.nn.Module` with the right class count.
    """
    from app.domain.models.custom_frcnn import FasterRCNN

    return FasterRCNN(score_thresh=score_threshold)


class FasterRCNNBackend(BaseModelBackend):
    """Trained Faster R-CNN, loaded once and reused for every request.

    Args:
        checkpoint_path: Absolute path to ``best.pth``.
        device: Requested device string (``"auto"`` by default).
        score_threshold: Minimum detection score to keep.
    """

    architecture = "faster_rcnn"

    def __init__(
        self,
        checkpoint_path: Path,
        *,
        device: str = "auto",
        score_threshold: float = 0.5,
    ) -> None:
        """Store configuration without touching the checkpoint (see :meth:`load`)."""
        self._checkpoint_path = checkpoint_path
        self._requested_device = device
        self._score_threshold = score_threshold
        self._model: torch.nn.Module | None = None
        self._device: torch.device | None = None

    @property
    def checkpoint_path(self) -> Path:
        """The checkpoint this backend was constructed to load."""
        return self._checkpoint_path

    def load(self) -> None:
        """Load the checkpoint and move the model to the target device.

        Raises:
            ModelNotLoadedError: The checkpoint is missing or cannot be parsed
                into a usable model. The message never includes the filesystem
                path (Frontend Integration §11 forbids leaking it).
        """
        import torch

        if not self._checkpoint_path.exists():
            logger.error("Model checkpoint not found at configured path.")
            raise ModelNotLoadedError("The AI model checkpoint was not found on disk.")

        device = _resolve_device(self._requested_device)
        try:
            # weights_only=False: the checkpoint may be a full pickled module.
            # The file ships with the application and is trusted.
            loaded: Any = torch.load(self._checkpoint_path, map_location=device, weights_only=False)
            model = self._materialise_model(loaded)
            model.to(device)
            model.eval()
        except ModelNotLoadedError:
            raise
        except Exception as error:  # noqa: BLE001 - surfaced as a controlled 503
            logger.exception("Failed to load AI model checkpoint.")
            raise ModelNotLoadedError("The AI model checkpoint could not be loaded.") from error

        self._model = model
        self._device = device
        logger.info(
            "AI model loaded (architecture=%s, device=%s, classes=%d).",
            self.architecture,
            device.type,
            NUM_FOREGROUND_CLASSES,
        )

    def _materialise_model(self, loaded: Any) -> torch.nn.Module:
        """Turn whatever ``torch.load`` returned into a ready module.

        Handles the whole-module save, the bare state dict, and the common
        nested forms (``{"model": ...}``, ``{"state_dict": ...}``).

        Args:
            loaded: The object returned by :func:`torch.load`.

        Returns:
            A module with weights loaded.

        Raises:
            ModelNotLoadedError: The object is not a shape this loader supports.
        """
        import torch

        if isinstance(loaded, torch.nn.Module):
            return loaded

        state_dict = loaded
        if isinstance(loaded, dict):
            for key in ("model", "state_dict", "model_state_dict"):
                inner = loaded.get(key)
                if isinstance(inner, torch.nn.Module):
                    return inner
                if isinstance(inner, dict):
                    state_dict = inner
                    break

        if not isinstance(state_dict, dict):
            raise ModelNotLoadedError("The AI model checkpoint is in an unrecognised format.")

        model = _build_model(self._score_threshold)
        model.load_state_dict(state_dict)
        return model

    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:
        """Run inference on one RGB image.

        Args:
            image_rgb: ``H x W x 3`` uint8 array in RGB order.

        Returns:
            Foreground detections at or above the score threshold, in the pixel
            coordinates of ``image_rgb``.

        Raises:
            ModelNotLoadedError: :meth:`load` has not completed successfully.
            InferenceError: The forward pass failed.
        """
        import torch

        if self._model is None or self._device is None:
            raise ModelNotLoadedError("The AI model is not currently available.")

        original_height, original_width = image_rgb.shape[0], image_rgb.shape[1]
        try:
            tensor = self._to_input_tensor(image_rgb).to(self._device)
            with torch.inference_mode():
                outputs = self._model(tensor.unsqueeze(0))
            return self._parse_outputs(outputs[0], original_width, original_height)
        except ModelNotLoadedError:
            raise
        except Exception as error:  # noqa: BLE001 - surfaced as a controlled 500
            logger.exception("AI inference forward pass failed.")
            raise InferenceError from error

    def _to_input_tensor(self, image_rgb: np.ndarray) -> torch.Tensor:
        """Resize and normalise an RGB uint8 array to the tensor the model expects.

        Unlike torchvision detection models, the custom network has no
        internal resize/normalise: it was trained on a fixed
        ``MODEL_INPUT_SIZE`` square with mean/std 0.5, so the source image is
        resized here and its detections rescaled back in
        :meth:`_parse_outputs`.

        Args:
            image_rgb: ``H x W x 3`` uint8 array.

        Returns:
            A ``3 x MODEL_INPUT_SIZE x MODEL_INPUT_SIZE`` normalised float tensor.
        """
        import cv2
        import torch

        resized = cv2.resize(image_rgb, (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE))
        array = resized.astype(np.float32) / 255.0
        tensor = torch.from_numpy(array).permute(2, 0, 1)
        mean = torch.tensor(NORM_MEAN).view(3, 1, 1)
        std = torch.tensor(NORM_STD).view(3, 1, 1)
        return (tensor - mean) / std

    def _parse_outputs(
        self,
        output: dict[str, torch.Tensor],
        original_width: int,
        original_height: int,
    ) -> list[RawDetection]:
        """Convert one image's model-space detections to domain detections.

        The detection head already applies its own score threshold and NMS
        (see :func:`app.domain.models.custom_frcnn.roi_head.postprocess_detections`),
        so this only rescales boxes from ``MODEL_INPUT_SIZE`` model space back
        to the source image's pixel coordinates.

        Args:
            output: The per-image dict with ``boxes``, ``labels`` and ``scores``,
                in ``MODEL_INPUT_SIZE`` x ``MODEL_INPUT_SIZE`` model space.
            original_width: Width of the source image, in pixels.
            original_height: Height of the source image, in pixels.

        Returns:
            Foreground detections in the pixel coordinates of the source image.
        """
        boxes = output["boxes"].detach().cpu().numpy()
        labels = output["labels"].detach().cpu().numpy()
        scores = output["scores"].detach().cpu().numpy()
        scale_x = original_width / MODEL_INPUT_SIZE
        scale_y = original_height / MODEL_INPUT_SIZE

        detections: list[RawDetection] = []
        for box, label, score in zip(boxes, labels, scores, strict=True):
            label_index = int(label)
            if label_index == 0:
                continue
            x1, y1, x2, y2 = (float(value) for value in box)
            detections.append(
                RawDetection(
                    label_index=label_index,
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
        device = self._device.type if self._device is not None else self._requested_device
        return ModelMetadata(
            architecture=self.architecture,
            device=str(device),
            num_classes=NUM_FOREGROUND_CLASSES,
            score_threshold=self._score_threshold,
        )

    @staticmethod
    def warmup_shape() -> tuple[int, int, int]:
        """Return a representative input shape for an optional warmup pass.

        A first forward pass allocates lazy CUDA kernels and is markedly slower;
        callers may run one throwaway inference at this shape at startup so the
        first real request is not the one that pays for it.

        Returns:
            ``(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3)``.
        """
        return (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3)


def _now_ms() -> float:
    """Monotonic timestamp in milliseconds, for timing a forward pass."""
    return time.perf_counter() * 1000.0
