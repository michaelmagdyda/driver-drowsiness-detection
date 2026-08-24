"""Region Proposal Network - inference path only.

Ported from ``ML/models/rpn.py``. Target assignment and the RPN loss are
training-only and omitted.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F  # noqa: N812 - conventional alias for torch's functional API

from app.domain.models.custom_frcnn._geometry import (
    NUM_ANCHORS,
    RPN_MIN_SIZE,
    RPN_NMS_IOU,
    RPN_POST_NMS_TEST,
    RPN_PRE_NMS_TEST,
)
from app.domain.models.custom_frcnn.box_utils import clip_boxes, decode_boxes, remove_small_boxes
from app.domain.models.custom_frcnn.nms import nms


class RPN(nn.Module):
    """Shared 3x3 conv, then sibling 1x1 objectness/box-offset heads."""

    def __init__(self, in_channels: int = 256, num_anchors: int = NUM_ANCHORS) -> None:
        """Build the shared conv and the objectness/box-offset head convs."""
        super().__init__()
        self.num_anchors = num_anchors
        self.conv = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.cls_logits = nn.Conv2d(in_channels, num_anchors, kernel_size=1)
        self.bbox_pred = nn.Conv2d(in_channels, num_anchors * 4, kernel_size=1)

    def forward(self, features: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Features ``[B,C,H,W]`` -> objectness ``[B,K]``, deltas ``[B,K,4]``."""
        b = features.shape[0]
        t = F.relu(self.conv(features))
        obj = self.cls_logits(t)
        box = self.bbox_pred(t)

        # reorder to (h, w, a) so it lines up with the anchor list
        obj = obj.permute(0, 2, 3, 1).reshape(b, -1)
        box = box.permute(0, 2, 3, 1).reshape(b, -1, 4)
        return obj, box


@torch.no_grad()
def generate_proposals(
    objectness: torch.Tensor,
    deltas: torch.Tensor,
    anchors: torch.Tensor,
    img_size: int,
) -> list[torch.Tensor]:
    """Turn RPN predictions into region proposals for the RoI head.

    Returns a list (length B) of proposal box tensors ``[P, 4]``.
    """
    b = objectness.shape[0]
    proposals_batch = []
    for i in range(b):
        scores = torch.sigmoid(objectness[i])
        boxes = decode_boxes(deltas[i], anchors)
        boxes = clip_boxes(boxes, img_size)

        keep = remove_small_boxes(boxes, RPN_MIN_SIZE)
        boxes, scores = boxes[keep], scores[keep]

        n = min(RPN_PRE_NMS_TEST, scores.numel())
        top = scores.topk(n).indices
        boxes, scores = boxes[top], scores[top]

        keep = nms(boxes, scores, RPN_NMS_IOU)[:RPN_POST_NMS_TEST]
        proposals_batch.append(boxes[keep])
    return proposals_batch
