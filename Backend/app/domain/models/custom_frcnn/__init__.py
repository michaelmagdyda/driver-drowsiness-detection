"""Vendored, inference-only copy of the project's from-scratch Faster R-CNN.

Ported from ``ML/models/`` (the training repo) because the deployed container
only copies ``Backend/app`` - the training code is not available at runtime.
Training-only code (losses, target assignment) is omitted; this package only
reconstructs the architecture and runs the forward pass that
``checkpoints/tuned/best.pth`` was trained against.

Geometry (anchor scales/ratios, backbone stride, head dimensions) is locked by
the trained weights - do not change it without retraining.

:class:`FasterRCNN` is re-exported **lazily**, via a module-level
``__getattr__`` (PEP 562). Importing it eagerly pulled ``torch`` and
``torchvision`` into every process that touched this package - including the
ONNX runtime, which reaches in only for the normalisation constants in
:mod:`._geometry` (see ``onnx_backend.py``). Because importing *any* submodule
first executes this file, that one eager line put ~2 GB of PyTorch wheels into
an image that never calls PyTorch.

The lazy form is transparent to callers: ``from app.domain.models.custom_frcnn
import FasterRCNN`` still works, and the ``.pth`` PyTorch backend is unaffected
because it already performs that import inside a function at call time
(``app/domain/models/faster_rcnn.py``). torch is imported on first attribute
access and not before.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.domain.models.custom_frcnn.faster_rcnn import FasterRCNN

__all__ = ["FasterRCNN"]


def __getattr__(name: str) -> Any:
    """Resolve :class:`FasterRCNN` on first access, importing torch only then."""
    if name == "FasterRCNN":
        from app.domain.models.custom_frcnn.faster_rcnn import FasterRCNN

        return FasterRCNN

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    """Keep ``dir()`` and tab-completion honest about the lazy export."""
    return sorted(__all__)
