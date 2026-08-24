"""Builds a detector backend from settings and a checkpoint path.

Extracted from ``app.main``'s startup wiring so the admin model-switching
feature (:mod:`app.services.model_admin_service`) can build a backend for an
arbitrary checkpoint - to dry-run its compatibility, or to actually activate
it - identically to how the process built its initial one, without
duplicating the device/score-threshold wiring in two places.

:func:`build_backend` dispatches on the checkpoint's file extension: ``.onnx``
gets :class:`~app.domain.models.onnx_backend.OnnxFasterRCNNBackend` (an ONNX
Runtime session), anything else gets
:class:`~app.domain.models.faster_rcnn.FasterRCNNBackend` (a PyTorch forward
pass) - the two are interchangeable for a given checkpoint's weights, so
neither the manager nor the admin service needs to know which one it got.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.domain.models.faster_rcnn import FasterRCNNBackend
from app.domain.models.onnx_backend import OnnxFasterRCNNBackend

if TYPE_CHECKING:
    from pathlib import Path

    from app.core.config import Settings
    from app.domain.models.base import BaseModelBackend

_ONNX_SUFFIX = ".onnx"


def build_backend(
    settings: Settings,
    path: Path,
    *,
    score_threshold: float | None = None,
    device: str | None = None,
) -> BaseModelBackend:
    """Construct (but do not load) a backend for ``path``.

    Args:
        settings: Validated application settings, for device and the default
            score threshold - never for the checkpoint path itself, which the
            caller supplies explicitly.
        path: The checkpoint this backend should load when ``.load()`` is
            called. A ``.onnx`` extension selects the ONNX Runtime backend;
            any other extension (``.pth``) selects the PyTorch backend.
        score_threshold: Overrides ``settings.model_score_threshold`` when
            given. Used by the admin "set confidence threshold" feature to
            rebuild the active backend at a new threshold without touching
            the process-wide settings object.
        device: Overrides ``settings.model_device`` when given. Used by the
            admin "set compute backend" feature to rebuild the active backend
            targeting CPU or GPU without touching the process-wide settings
            object.

    Returns:
        An un-loaded backend implementing :class:`BaseModelBackend`.
    """
    resolved_threshold = (
        score_threshold if score_threshold is not None else settings.model_score_threshold
    )
    resolved_device = device if device is not None else settings.model_device
    backend_cls = (
        OnnxFasterRCNNBackend if path.suffix.lower() == _ONNX_SUFFIX else FasterRCNNBackend
    )
    return backend_cls(
        path,
        device=resolved_device,
        score_threshold=resolved_threshold,
    )


def build_faster_rcnn_backend(
    settings: Settings, path: Path, *, score_threshold: float | None = None
) -> FasterRCNNBackend:
    """Construct (but do not load) a PyTorch :class:`FasterRCNNBackend` for ``path``.

    Kept alongside :func:`build_backend` for callers that specifically need
    the PyTorch backend (compatibility dry-runs against a known ``.pth``, and
    existing tests that assert on this exact type).

    Args:
        settings: Validated application settings, for device and the default
            score threshold.
        path: The ``.pth`` checkpoint this backend should load.
        score_threshold: Overrides ``settings.model_score_threshold`` when given.

    Returns:
        An un-loaded :class:`FasterRCNNBackend`.
    """
    return FasterRCNNBackend(
        path,
        device=settings.model_device,
        score_threshold=(
            score_threshold if score_threshold is not None else settings.model_score_threshold
        ),
    )
