"""Architecture constants locked by the trained checkpoint.

Mirrors ``ML/config.py``'s "Image / backbone geometry (LOCKED)" and anchor
sections. ``IMG_SIZE`` and ``NUM_CLASSES`` are derived from
:mod:`app.core.constants` so the two never drift apart - both describe the
same trained weights.
"""

from __future__ import annotations

from app.core.constants import MODEL_INPUT_SIZE, NUM_FOREGROUND_CLASSES

IMG_SIZE: int = MODEL_INPUT_SIZE
BACKBONE_STRIDE: int = 16
FEATURE_SIZE: int = IMG_SIZE // BACKBONE_STRIDE

NUM_CLASSES: int = NUM_FOREGROUND_CLASSES + 1  # +1 for background

ANCHOR_SCALES: list[int] = [8, 16, 32, 64]
ANCHOR_RATIOS: list[float] = [0.5, 1.0, 2.0, 3.0]
NUM_ANCHORS: int = len(ANCHOR_SCALES) * len(ANCHOR_RATIOS)

ROI_OUTPUT_SIZE: int = 7
ROI_FC_DIM: int = 1024

RPN_NMS_IOU: float = 0.7
RPN_MIN_SIZE: int = 8
RPN_PRE_NMS_TEST: int = 1000
RPN_POST_NMS_TEST: int = 300

DET_NMS_IOU: float = 0.4
DETECTIONS_PER_IMG: int = 50

NORM_MEAN: tuple[float, float, float] = (0.5, 0.5, 0.5)
NORM_STD: tuple[float, float, float] = (0.5, 0.5, 0.5)
