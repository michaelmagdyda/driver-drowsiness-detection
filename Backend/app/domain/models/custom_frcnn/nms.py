"""Non-maximum suppression. Ported from ``ML/utils/nms.py``.

The educational from-scratch variant is omitted - this service only needs the
fast, torchvision-backed path that the reference implementation used at
inference time.
"""

from __future__ import annotations

import torch
from torchvision.ops import nms as tv_nms


def nms(boxes: torch.Tensor, scores: torch.Tensor, iou_threshold: float) -> torch.Tensor:
    """Indices of boxes to keep, sorted by score."""
    if boxes.numel() == 0:
        return torch.empty((0,), dtype=torch.long, device=boxes.device)
    return tv_nms(boxes, scores, iou_threshold)
