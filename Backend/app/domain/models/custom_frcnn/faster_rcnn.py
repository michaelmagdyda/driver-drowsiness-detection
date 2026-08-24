"""The complete simplified Faster R-CNN detector - inference path only.

Ported from ``ML/models/faster_rcnn.py``. Pipeline:
    image -> backbone -> feature map
          -> RPN (+ anchors) -> proposals
          -> RoI Align + detection head -> class + box

Training mode (the four losses) is omitted - this service only loads a
trained checkpoint and runs forward passes.
"""

from __future__ import annotations

import torch
import torch.nn as nn

from app.domain.models.custom_frcnn._geometry import (
    ANCHOR_RATIOS,
    ANCHOR_SCALES,
    BACKBONE_STRIDE,
    FEATURE_SIZE,
    IMG_SIZE,
)
from app.domain.models.custom_frcnn.anchors import generate_anchors
from app.domain.models.custom_frcnn.backbone import BackboneCNN
from app.domain.models.custom_frcnn.roi_head import RoIHead
from app.domain.models.custom_frcnn.rpn import RPN, generate_proposals


class FasterRCNN(nn.Module):
    """Two-stage detector: RPN proposals refined by an RoI detection head.

    Args:
        score_thresh: Minimum per-class score kept by the detection head's
            post-processing, forwarded from the deployment's configured
            threshold rather than hardcoded.
    """

    def __init__(self, score_thresh: float = 0.5) -> None:
        """Build the backbone, RPN and RoI head, and cache the score threshold."""
        super().__init__()
        self.backbone = BackboneCNN()
        self.rpn = RPN(in_channels=self.backbone.out_channels)
        self.roi_head = RoIHead(in_channels=self.backbone.out_channels, stride=self.backbone.stride)
        self.score_thresh = score_thresh
        self._anchor_cache: torch.Tensor | None = None

    def _get_anchors(self, device: torch.device) -> torch.Tensor:
        if self._anchor_cache is None or self._anchor_cache.device != device:
            self._anchor_cache = generate_anchors(
                FEATURE_SIZE, BACKBONE_STRIDE, ANCHOR_SCALES, ANCHOR_RATIOS, device=device
            )
        return self._anchor_cache

    def forward(self, images: torch.Tensor) -> list[dict[str, torch.Tensor]]:
        """Images ``[B,3,IMG_SIZE,IMG_SIZE]`` -> list of per-image detection dicts."""
        features = self.backbone(images)
        anchors = self._get_anchors(images.device)

        objectness, deltas = self.rpn(features)
        proposals = generate_proposals(objectness, deltas, anchors, IMG_SIZE)

        return self.roi_head(features, proposals, IMG_SIZE, self.score_thresh)
