"""RoI Align + fully-connected detection head - inference path only.

Ported from ``ML/models/roi_head.py``. Target assignment and the detection
loss are training-only and omitted.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F  # noqa: N812 - conventional alias for torch's functional API
from torchvision.ops import roi_align

from app.domain.models.custom_frcnn._geometry import (
    DET_NMS_IOU,
    DETECTIONS_PER_IMG,
    NUM_CLASSES,
    ROI_FC_DIM,
    ROI_OUTPUT_SIZE,
)
from app.domain.models.custom_frcnn.box_utils import clip_boxes, decode_boxes
from app.domain.models.custom_frcnn.nms import nms


class RoIHead(nn.Module):
    """Per proposal: class scores ``[N, num_classes]`` and class-specific box deltas."""

    def __init__(
        self,
        in_channels: int = 256,
        roi_size: int = ROI_OUTPUT_SIZE,
        fc_dim: int = ROI_FC_DIM,
        num_classes: int = NUM_CLASSES,
        stride: int = 16,
    ) -> None:
        """Build the RoI Align config and the FC trunk/heads."""
        super().__init__()
        self.roi_size = roi_size
        self.spatial_scale = 1.0 / stride
        self.num_classes = num_classes

        self.fc1 = nn.Linear(in_channels * roi_size * roi_size, fc_dim)
        self.fc2 = nn.Linear(fc_dim, fc_dim)
        self.cls_score = nn.Linear(fc_dim, num_classes)
        self.bbox_pred = nn.Linear(fc_dim, num_classes * 4)

    def forward(
        self,
        features: torch.Tensor,
        proposals_list: list[torch.Tensor],
        img_size: int,
        score_thresh: float,
    ) -> list[dict[str, torch.Tensor]]:
        """RoI Align + FC trunk, then per-image post-processing into detections."""
        counts = [p.shape[0] for p in proposals_list]
        pooled = roi_align(
            features,
            proposals_list,
            output_size=(self.roi_size, self.roi_size),
            spatial_scale=self.spatial_scale,
        )
        x = pooled.flatten(1)
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        class_logits = self.cls_score(x)
        bbox_deltas = self.bbox_pred(x)

        probs = F.softmax(class_logits, dim=1)
        results = []
        cls_chunks = probs.split(counts)
        box_chunks = bbox_deltas.split(counts)
        for props, prob, deltas in zip(proposals_list, cls_chunks, box_chunks, strict=True):
            results.append(postprocess_detections(props, prob, deltas, img_size, score_thresh))
        return results


def postprocess_detections(
    proposals: torch.Tensor,
    probs: torch.Tensor,
    deltas: torch.Tensor,
    img_size: int,
    score_thresh: float,
    nms_iou: float = DET_NMS_IOU,
    max_det: int = DETECTIONS_PER_IMG,
) -> dict[str, torch.Tensor]:
    """Turn head outputs into final detections: boxes ``[D,4]``, labels ``[D]``, scores ``[D]``."""
    device = proposals.device
    deltas = deltas.view(-1, NUM_CLASSES, 4)
    all_boxes, all_scores, all_labels = [], [], []

    # skip class 0 (background); handle each foreground class separately
    for c in range(1, NUM_CLASSES):
        scores_c = probs[:, c]
        keep = scores_c > score_thresh
        if keep.sum() == 0:
            continue
        boxes_c = decode_boxes(deltas[keep, c], proposals[keep])
        boxes_c = clip_boxes(boxes_c, img_size)
        scores_c = scores_c[keep]

        k = nms(boxes_c, scores_c, nms_iou)
        all_boxes.append(boxes_c[k])
        all_scores.append(scores_c[k])
        all_labels.append(torch.full((k.numel(),), c, dtype=torch.long, device=device))

    if not all_boxes:
        return {
            "boxes": torch.zeros((0, 4), device=device),
            "labels": torch.zeros((0,), dtype=torch.long, device=device),
            "scores": torch.zeros((0,), device=device),
        }

    boxes = torch.cat(all_boxes)
    scores = torch.cat(all_scores)
    labels = torch.cat(all_labels)
    if scores.numel() > max_det:
        top = scores.topk(max_det).indices
        boxes, scores, labels = boxes[top], scores[top], labels[top]
    return {"boxes": boxes, "labels": labels, "scores": scores}
