"""Detector backends (Phase G).

A small, substitutable set of classes that turn pixels into detections:

``base.py``
    :class:`BaseModelBackend` - the interface every detector implements, plus
    :class:`RawDetection`, the plain box/label/score triple a backend returns.

``faster_rcnn.py``
    :class:`FasterRCNNBackend` - adapter over the project's trained,
    from-scratch Faster R-CNN checkpoint. Wraps the existing training/inference
    code rather than reimplementing it (03_Backend_Architecture.md §8).

``manager.py``
    :class:`ModelManager` - owns the loaded backend, reports its status for the
    health endpoints, and is the only object a route or service reaches the
    model through (§16). Loading happens once, at startup (§25), with
    ``switch_checkpoint`` available afterwards for the admin model-switching
    feature.

``onnx_backend.py``
    :class:`OnnxFasterRCNNBackend` - adapter over an end-to-end ONNX export of
    the same trained network (``ML/export_onnx.py``), run through ONNX
    Runtime instead of PyTorch.

``factory.py``
    :func:`build_backend` - builds a backend from settings and a checkpoint
    path, dispatching on file extension (``.onnx`` vs ``.pth``); shared by
    startup and the admin model-switching feature so both construct backends
    identically.

The interface exists so a future detector (RF-DETR, a retrained model) is
substitutable without touching a route (Liskov, Coding Standards §4).
"""

from app.domain.models.base import BaseModelBackend, ModelMetadata, RawDetection
from app.domain.models.factory import build_backend, build_faster_rcnn_backend
from app.domain.models.faster_rcnn import FasterRCNNBackend
from app.domain.models.manager import ModelManager
from app.domain.models.onnx_backend import OnnxFasterRCNNBackend

__all__ = [
    "BaseModelBackend",
    "FasterRCNNBackend",
    "ModelManager",
    "ModelMetadata",
    "OnnxFasterRCNNBackend",
    "RawDetection",
    "build_backend",
    "build_faster_rcnn_backend",
]
