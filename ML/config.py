"""
config.py
---------
Central constants for the whole project. Import from here everywhere so the
numbers stay consistent.
"""

import os

# ----------------------------------------------------------------------------
# Paths
# ----------------------------------------------------------------------------
DATA_DIR    = "data"
IMAGES_DIR  = os.path.join(DATA_DIR, "images")
LABELS_DIR  = os.path.join(DATA_DIR, "labels")
SPLITS_DIR  = os.path.join(DATA_DIR, "splits")
CKPT_DIR    = "checkpoints"
RESULTS_DIR = "results"

# ----------------------------------------------------------------------------
# Image / backbone geometry  (LOCKED)
# ----------------------------------------------------------------------------
IMG_SIZE        = 640
BACKBONE_STRIDE = 16
FEATURE_SIZE    = IMG_SIZE // BACKBONE_STRIDE

# ----------------------------------------------------------------------------
# Classes  (order must match your YOLO class ids)
# ----------------------------------------------------------------------------
CLASS_NAMES    = ["closed_eye", "open_eye", "yawn"]
NUM_FG_CLASSES = len(CLASS_NAMES)
NUM_CLASSES    = NUM_FG_CLASSES + 1
MODEL_LABELS   = ["background"] + CLASS_NAMES


def yolo_id_to_model_label(yolo_id: int) -> int:
    return int(yolo_id) + 1


# ----------------------------------------------------------------------------
# Normalization + split
# ----------------------------------------------------------------------------
NORM_MEAN    = (0.5, 0.5, 0.5)
NORM_STD     = (0.5, 0.5, 0.5)
SPLIT_RATIOS = (0.70, 0.15, 0.15)
SPLIT_SEED   = 42

# ----------------------------------------------------------------------------
# Anchors  (4 scales x 4 ratios = 16 anchors per feature-map cell)
# ----------------------------------------------------------------------------
ANCHOR_SCALES = [8, 16, 32, 64]
ANCHOR_RATIOS = [0.5, 1.0, 2.0, 3.0]
NUM_ANCHORS   = len(ANCHOR_SCALES) * len(ANCHOR_RATIOS)

# ----------------------------------------------------------------------------
# RPN
# ----------------------------------------------------------------------------
RPN_POS_IOU   = 0.7
RPN_NEG_IOU   = 0.3
RPN_BATCH     = 256
RPN_POS_FRAC  = 0.5
RPN_NMS_IOU   = 0.7
RPN_MIN_SIZE  = 8
RPN_PRE_NMS_TRAIN  = 2000
RPN_POST_NMS_TRAIN = 1000
RPN_PRE_NMS_TEST   = 1000
RPN_POST_NMS_TEST  = 300

# ----------------------------------------------------------------------------
# RoI detection head
# ----------------------------------------------------------------------------
ROI_OUTPUT_SIZE = 7
ROI_FC_DIM      = 1024
ROI_FG_IOU      = 0.5
ROI_BG_IOU_HI   = 0.5
ROI_BG_IOU_LO   = 0.0
ROI_BATCH       = 128
ROI_POS_FRAC    = 0.25

# ----------------------------------------------------------------------------
# Inference / detection post-processing
# ----------------------------------------------------------------------------
SCORE_THRESH       = 0.5
DET_NMS_IOU        = 0.4
DETECTIONS_PER_IMG = 50

# ----------------------------------------------------------------------------
# Training - NEW from-scratch experiment
# ----------------------------------------------------------------------------
BATCH_SIZE = 4
NUM_EPOCHS = 80

# Optimizer: "adamw" or "sgd"
OPTIMIZER = "adamw"
LR = 3e-4
WEIGHT_DECAY = 1e-4
MOMENTUM = 0.9       # used only by SGD

# Optional gradient clipping. Set to 0 or None to disable.
GRAD_CLIP_NORM = 5.0

# Learning-rate scheduler: "cosine", "plateau", or "step"
LR_SCHEDULER = "cosine"

# Warmup is used with cosine. LR increases linearly during the first N epochs.
WARMUP_EPOCHS = 5
COSINE_MIN_LR = 1e-6

# Plateau settings
PLATEAU_FACTOR   = 0.5
PLATEAU_PATIENCE = 4
PLATEAU_MIN_LR   = 1e-6

# StepLR settings
LR_STEP  = 20
LR_GAMMA = 0.1

# Early stopping monitors validation mAP@0.5.
EARLY_STOP_PATIENCE = 15

# Export an inference-ready ONNX model beside every saved checkpoint.  The PTH
# files are intentionally kept because they contain optimizer/scheduler state
# required by --resume.  ONNX export currently uses a fixed batch size of 1.
EXPORT_ONNX = True
ONNX_OPSET = 17

# ----------------------------------------------------------------------------
# Data augmentation (training split only) - unchanged for controlled comparison
# ----------------------------------------------------------------------------
AUG_HFLIP_PROB = 0.5
AUG_COLOR_JITTER = dict(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.02)
AUG_AFFINE_PROB  = 0.5
AUG_AFFINE_DEG   = 8
AUG_AFFINE_SCALE = (0.8, 1.2)
AUG_AFFINE_TRANS = 0.10
