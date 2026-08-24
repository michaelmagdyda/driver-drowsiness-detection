"""Image analysis service (Phase G).

Orchestrates one image analysis: validate the upload, decode it, run inference
off the event loop, and hand the detections to the pure domain classifier. It is
the seam between the transport layer (which speaks ``UploadFile`` and HTTP) and
the domain layer (which speaks only arrays and detections), and it owns every
concern that is neither pure computation nor pure transport:

* **Upload validation** - MIME type and size, the authoritative check the
  frontend only pre-screens (Frontend Integration §8).
* **Decoding** - bytes to an ``H x W x 3`` RGB array.
* **Offloading** - PyTorch inference is synchronous and CPU/GPU-bound, so it is
  run in a worker thread via ``run_in_threadpool``; awaiting it there keeps the
  event loop free to serve other requests (Coding Standards §10).

Business rules live here; the route below is a thin adapter.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

import numpy as np
from fastapi.concurrency import run_in_threadpool

from app.core.constants import ALLOWED_IMAGE_MIME_TYPES
from app.core.exceptions import FileTooLargeError, UnsupportedMediaError
from app.core.logging import get_logger
from app.domain.analysis import FrameAnalysis, analyze_frame

if TYPE_CHECKING:
    from app.domain.models.manager import ModelManager

logger = get_logger(__name__)


class AnalysisService:
    """Runs a single image through validation, decoding, inference and classification.

    Args:
        manager: The loaded model manager. Injected, never constructed here, so
            the process-wide singleton is shared.
        max_image_bytes: Hard upper bound on an accepted upload.
    """

    def __init__(self, manager: ModelManager, *, max_image_bytes: int) -> None:
        """Bind the shared model manager and the upload size limit."""
        self._manager = manager
        self._max_image_bytes = max_image_bytes

    async def analyze_image(
        self,
        *,
        content: bytes,
        content_type: str | None,
    ) -> FrameAnalysis:
        """Validate, decode and analyse one uploaded image.

        Args:
            content: Raw bytes of the uploaded file.
            content_type: Declared MIME type, or ``None``.

        Returns:
            The domain :class:`FrameAnalysis` for the image.

        Raises:
            UnsupportedMediaError: The MIME type is not an accepted image type,
                or the bytes cannot be decoded as an image.
            FileTooLargeError: The upload exceeds the configured size limit.
            InferenceError: Decoding succeeded but the forward pass failed.
        """
        self._validate(content=content, content_type=content_type)
        image_rgb = self._decode(content)
        height, width = image_rgb.shape[0], image_rgb.shape[1]

        started = time.perf_counter()
        detections = await run_in_threadpool(self._manager.predict, image_rgb)
        inference_ms = (time.perf_counter() - started) * 1000.0

        return analyze_frame(
            detections,
            image_width=width,
            image_height=height,
            inference_ms=round(inference_ms, 2),
        )

    def _validate(self, *, content: bytes, content_type: str | None) -> None:
        """Enforce MIME type and size before spending work on decoding.

        Args:
            content: Raw upload bytes.
            content_type: Declared MIME type.

        Raises:
            UnsupportedMediaError: Unaccepted or missing MIME type.
            FileTooLargeError: Over the configured size limit.
        """
        if (
            content_type is None
            or content_type.split(";")[0].strip() not in ALLOWED_IMAGE_MIME_TYPES
        ):
            raise UnsupportedMediaError(
                "Upload must be a JPEG, PNG or WebP image.",
            )
        if len(content) > self._max_image_bytes:
            raise FileTooLargeError()
        if not content:
            raise UnsupportedMediaError("The uploaded image is empty.")

    def _decode(self, content: bytes) -> np.ndarray:
        """Decode image bytes to an ``H x W x 3`` uint8 RGB array.

        OpenCV decodes to BGR; the array is flipped to RGB so the detector - and
        everything downstream - works in a single, documented channel order.

        Args:
            content: Raw image bytes.

        Returns:
            The decoded RGB image.

        Raises:
            UnsupportedMediaError: The bytes are not a decodable image.
        """
        import cv2

        buffer = np.frombuffer(content, dtype=np.uint8)
        bgr = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
        if bgr is None:
            raise UnsupportedMediaError("The uploaded file could not be decoded as an image.")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        return np.ascontiguousarray(rgb)
