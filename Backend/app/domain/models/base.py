"""Detector interface and the raw result it returns.

Pure domain types: no HTTP, no Pydantic, no ``UploadFile``. A backend is handed
a decoded image (an ``H x W x 3`` uint8 RGB array) and returns a list of
:class:`RawDetection`. Everything above this - scoring, driver state, the wire
envelope - is someone else's job.

Inference is intentionally *synchronous*. PyTorch and OpenCV are CPU/GPU-bound
native code; wrapping a forward pass in ``async`` yields no concurrency and
would block the event loop (Coding Standards §10). The service layer offloads
these calls to a thread pool instead.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path

    import numpy as np


@dataclass(frozen=True, slots=True)
class RawDetection:
    """One detection straight from a backend, before any interpretation.

    Coordinates are in pixels of the image that was passed in. ``label_index``
    is the model's own class index and indexes
    :data:`~app.core.constants.MODEL_LABELS`.

    Attributes:
        label_index: Integer class index. ``0`` is background and is filtered
            out before a detection reaches the domain, so foreground detections
            carry ``1..3``.
        score: Confidence in ``[0, 1]``.
        x1: Left edge, pixels.
        y1: Top edge, pixels.
        x2: Right edge, pixels.
        y2: Bottom edge, pixels.
    """

    label_index: int
    score: float
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def width(self) -> float:
        """Box width in pixels."""
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        """Box height in pixels."""
        return max(0.0, self.y2 - self.y1)

    @property
    def area(self) -> float:
        """Box area in square pixels."""
        return self.width * self.height


@dataclass(frozen=True, slots=True)
class ModelMetadata:
    """Descriptive facts about a loaded backend, for the health endpoints.

    Attributes:
        architecture: Human-readable architecture name, e.g. ``"faster_rcnn"``.
        device: Torch device the weights are resident on, e.g. ``"cpu"``,
            ``"cuda:0"``.
        num_classes: Number of foreground classes the head predicts.
        score_threshold: Minimum score a detection must clear to be returned.
    """

    architecture: str
    device: str
    num_classes: int
    score_threshold: float


class BaseModelBackend(ABC):
    """Interface every detector implements.

    A backend is constructed cheaply; the expensive weight load happens in
    :meth:`load`, which the :class:`~app.domain.models.manager.ModelManager`
    calls exactly once at startup. :meth:`predict` may then be called many
    times and must be safe to invoke from a worker thread.
    """

    @property
    @abstractmethod
    def checkpoint_path(self) -> Path:
        """Filesystem path of the checkpoint this backend was built to load.

        Read regardless of load state, so the model-switching admin feature
        can report which checkpoint is configured even before (or after) a
        failed load. Never exposed verbatim to non-admin clients (Frontend
        Integration §11 forbids leaking the model path).
        """

    @abstractmethod
    def load(self) -> None:
        """Load weights into memory and prepare the model for inference.

        Called once, off the request path. Implementations that fail to find or
        parse the checkpoint raise, and the manager records the failure so the
        service returns :class:`~app.core.exceptions.ModelNotLoadedError`.
        """

    @abstractmethod
    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:
        """Run one forward pass.

        Args:
            image_rgb: Decoded image as an ``H x W x 3`` uint8 array in RGB
                channel order.

        Returns:
            Foreground detections above the configured score threshold, in the
            pixel coordinate system of ``image_rgb``.
        """

    @abstractmethod
    def metadata(self) -> ModelMetadata:
        """Return descriptive metadata about the loaded model."""
