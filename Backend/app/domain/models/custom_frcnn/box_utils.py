"""Box math needed for inference. Ported from ``ML/utils/box_utils.py``.

Training-only helpers (``box_iou``, ``encode_boxes``) are omitted - this
service never trains.
"""

from __future__ import annotations

import torch


def decode_boxes(
    deltas: torch.Tensor,
    anchors: torch.Tensor,
    weights: tuple[float, float, float, float] = (1.0, 1.0, 1.0, 1.0),
) -> torch.Tensor:
    """Apply predicted offsets to anchors/proposals to get boxes."""
    wx, wy, ww, wh = weights
    a_w = anchors[:, 2] - anchors[:, 0]
    a_h = anchors[:, 3] - anchors[:, 1]
    a_cx = anchors[:, 0] + 0.5 * a_w
    a_cy = anchors[:, 1] + 0.5 * a_h

    tx = deltas[:, 0] / wx
    ty = deltas[:, 1] / wy
    tw = deltas[:, 2] / ww
    th = deltas[:, 3] / wh

    # clamp tw,th so exp() can't explode
    tw = torch.clamp(tw, max=4.0)
    th = torch.clamp(th, max=4.0)

    cx = tx * a_w + a_cx
    cy = ty * a_h + a_cy
    w = torch.exp(tw) * a_w
    h = torch.exp(th) * a_h

    x1 = cx - 0.5 * w
    y1 = cy - 0.5 * h
    x2 = cx + 0.5 * w
    y2 = cy + 0.5 * h
    return torch.stack([x1, y1, x2, y2], dim=1)


def clip_boxes(boxes: torch.Tensor, img_size: int) -> torch.Tensor:
    """Clamp box coordinates to lie inside a square image of side ``img_size``."""
    boxes = boxes.clone()
    boxes[:, 0::2] = boxes[:, 0::2].clamp(0, img_size)
    boxes[:, 1::2] = boxes[:, 1::2].clamp(0, img_size)
    return boxes


def remove_small_boxes(boxes: torch.Tensor, min_size: int) -> torch.Tensor:
    """Return a boolean keep-mask for boxes with both sides >= ``min_size``."""
    w = boxes[:, 2] - boxes[:, 0]
    h = boxes[:, 3] - boxes[:, 1]
    return (w >= min_size) & (h >= min_size)
