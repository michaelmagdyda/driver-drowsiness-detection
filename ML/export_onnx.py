"""
export_onnx.py
--------------
Export the trained Faster R-CNN checkpoint (.pth) to a single end-to-end
ONNX graph.

    image [1,3,640,640]  ->  boxes [D,4], labels [D], scores [D]

Everything is inside the graph: backbone, RPN, proposal decode + NMS,
RoI Align, detection head, per-class NMS and top-K. The consumer only has to
normalize the image and scale the returned boxes back to its own resolution.

Why this file exists instead of exporting FasterRCNN directly
-------------------------------------------------------------
`FasterRCNN.forward` in eval mode is not traceable:
  * it returns a *list of dicts*, which ONNX has no representation for;
  * `generate_proposals` picks `topk(min(pre_nms, scores.numel()))` and masks
    with `remove_small_boxes` -- both are Python-level, data-dependent;
  * `postprocess_detections` loops over classes with `if keep.sum() == 0:
    continue`, which bakes whatever happened on the dummy input into the graph.

`ONNXFasterRCNN` below reproduces the *same maths* with static-shaped tensor
ops, so the exported graph behaves identically on every input. The weights are
untouched -- it borrows the real submodules off the loaded model.

Usage
-----
    python export_onnx.py --checkpoint checkpoints/tuned_fixed/best.pth \
                          --out driver_drowsiness.onnx

    # skip the numerical check (needs onnx + onnxruntime installed)
    python export_onnx.py --checkpoint ... --no-verify

Requirements: torch, torchvision, and (for --verify) onnx, onnxruntime.
Run it from the ML/ directory so `import config` resolves.
"""

import argparse
import os
import sys
import warnings

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.ops import nms as tv_nms
from torchvision.ops import roi_align

import config
from models.faster_rcnn import FasterRCNN
from models.anchors import generate_anchors
from utils.box_utils import decode_boxes


# ---------------------------------------------------------------------------
# Export-friendly helpers
# ---------------------------------------------------------------------------
def clip_boxes_traceable(boxes, img_size):
    """
    Same as utils.box_utils.clip_boxes, but built with stack() instead of
    strided slice-assignment (`boxes[:, 0::2] = ...`), which the ONNX tracer
    turns into an awkward scatter.
    """
    x1 = boxes[:, 0].clamp(0.0, float(img_size))
    y1 = boxes[:, 1].clamp(0.0, float(img_size))
    x2 = boxes[:, 2].clamp(0.0, float(img_size))
    y2 = boxes[:, 3].clamp(0.0, float(img_size))
    return torch.stack([x1, y1, x2, y2], dim=1)


# ---------------------------------------------------------------------------
# The traceable detector
# ---------------------------------------------------------------------------
class ONNXFasterRCNN(nn.Module):
    """
    Batch-size-1 inference wrapper around a trained FasterRCNN.

    Holds no parameters of its own -- it reuses `model`'s submodules, so the
    exported weights are exactly the checkpoint's.
    """

    def __init__(self, model: FasterRCNN,
                 score_thresh=config.SCORE_THRESH,
                 nms_iou=config.DET_NMS_IOU,
                 max_det=config.DETECTIONS_PER_IMG,
                 rpn_pre_nms=config.RPN_PRE_NMS_TEST,
                 rpn_post_nms=config.RPN_POST_NMS_TEST):
        super().__init__()
        self.backbone = model.backbone
        self.rpn = model.rpn
        self.roi_head = model.roi_head

        # anchors depend only on the (locked) input geometry -> a graph constant
        anchors = generate_anchors(config.FEATURE_SIZE, config.BACKBONE_STRIDE,
                                   config.ANCHOR_SCALES, config.ANCHOR_RATIOS)
        self.register_buffer("anchors", anchors, persistent=False)

        self.img_size = float(config.IMG_SIZE)
        self.num_classes = config.NUM_CLASSES
        self.score_thresh = float(score_thresh)
        self.nms_iou = float(nms_iou)
        self.max_det = int(max_det)
        self.rpn_nms_iou = float(config.RPN_NMS_IOU)
        self.rpn_min_size = float(config.RPN_MIN_SIZE)
        self.rpn_post_nms = int(rpn_post_nms)

        # topk(k) needs a compile-time k; clamp it to the anchor count so the
        # op is always valid (K = 40*40*16 = 25600 with the current config).
        self.rpn_pre_nms = int(min(rpn_pre_nms, anchors.shape[0]))

    # -- stage 1: anchors + RPN deltas -> proposals ---------------------------
    def _proposals(self, objectness, deltas):
        """
        objectness [K], deltas [K,4] -> proposal boxes [P,4].

        Mirrors rpn.generate_proposals, with the small-box filter applied as a
        score mask *before* the top-K (so the ranking is identical) and re-applied
        as a real filter afterwards.
        """
        scores = torch.sigmoid(objectness)
        boxes = decode_boxes(deltas, self.anchors)
        boxes = clip_boxes_traceable(boxes, self.img_size)

        w = boxes[:, 2] - boxes[:, 0]
        h = boxes[:, 3] - boxes[:, 1]
        valid = (w >= self.rpn_min_size) & (h >= self.rpn_min_size)

        # sigmoid() is strictly > 0, so zeroed scores always sort last
        scores = torch.where(valid, scores, torch.zeros_like(scores))

        top = torch.topk(scores, k=self.rpn_pre_nms, dim=0).indices
        boxes, scores, valid = boxes[top], scores[top], valid[top]

        boxes, scores = boxes[valid], scores[valid]

        keep = tv_nms(boxes, scores, self.rpn_nms_iou)[: self.rpn_post_nms]
        return boxes[keep]

    # -- stage 2: RoI Align + detection head ---------------------------------
    def _head(self, features, proposals):
        # torchvision accepts rois as [P,5] = (batch_index, x1, y1, x2, y2)
        batch_idx = torch.zeros_like(proposals[:, :1])
        rois = torch.cat([batch_idx, proposals], dim=1)

        pooled = roi_align(features, rois,
                           output_size=(self.roi_head.roi_size,
                                        self.roi_head.roi_size),
                           spatial_scale=self.roi_head.spatial_scale,
                           sampling_ratio=-1,
                           aligned=False)
        x = pooled.flatten(1)
        x = F.relu(self.roi_head.fc1(x))
        x = F.relu(self.roi_head.fc2(x))
        return self.roi_head.cls_score(x), self.roi_head.bbox_pred(x)

    # -- stage 3: detections --------------------------------------------------
    def _postprocess(self, proposals, probs, deltas):
        """
        Vectorised equivalent of roi_head.postprocess_detections.

        The per-class loop is replaced by flattening (proposal x class) and
        using the standard class-offset trick, which makes one NMS call behave
        exactly like independent per-class NMS.
        """
        C = self.num_classes
        # drop background (class 0)
        d = deltas.view(-1, C, 4)[:, 1:, :]                      # [P, C-1, 4]
        fg = probs[:, 1:]                                        # [P, C-1]
        props = proposals.unsqueeze(1).expand(-1, C - 1, -1)     # [P, C-1, 4]

        boxes = decode_boxes(d.reshape(-1, 4), props.reshape(-1, 4))
        boxes = clip_boxes_traceable(boxes, self.img_size)
        scores = fg.reshape(-1)

        # labels [1..C-1] repeated per proposal, built by broadcast so no
        # dynamic shape ever enters the graph
        class_ids = torch.arange(1, C, device=fg.device, dtype=fg.dtype)
        labels = (torch.zeros_like(fg) + class_ids).reshape(-1)

        keep = scores > self.score_thresh
        boxes, scores, labels = boxes[keep], scores[keep], labels[keep]

        # push each class into its own coordinate band so classes never suppress
        # each other
        offsets = (labels * (self.img_size + 1.0)).unsqueeze(1)
        keep = tv_nms(boxes + offsets, scores, self.nms_iou)
        boxes, scores, labels = boxes[keep], scores[keep], labels[keep]

        # strongest detections overall, capped at max_det (Slice clamps if fewer)
        order = torch.sort(scores, dim=0, descending=True).indices[: self.max_det]
        return boxes[order], labels[order].to(torch.int64), scores[order]

    def forward(self, images):
        features = self.backbone(images)                # [1,256,40,40]
        objectness, deltas = self.rpn(features)         # [1,K], [1,K,4]
        proposals = self._proposals(objectness[0], deltas[0])
        logits, box_deltas = self._head(features, proposals)
        probs = F.softmax(logits, dim=1)
        return self._postprocess(proposals, probs, box_deltas)


# ---------------------------------------------------------------------------
# Checkpoint loading
# ---------------------------------------------------------------------------
def load_model(checkpoint_path, device="cpu"):
    model = FasterRCNN().to(device)
    try:
        ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    except TypeError:                       # torch < 2.0 has no weights_only
        ckpt = torch.load(checkpoint_path, map_location=device)

    if isinstance(ckpt, dict) and "model" in ckpt:
        state, epoch = ckpt["model"], ckpt.get("epoch", "?")
    elif isinstance(ckpt, dict) and "state_dict" in ckpt:
        state, epoch = ckpt["state_dict"], ckpt.get("epoch", "?")
    else:
        state, epoch = ckpt, "?"

    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing or unexpected:
        print(f"  ! missing keys:    {list(missing)[:8]}")
        print(f"  ! unexpected keys: {list(unexpected)[:8]}")
        raise SystemExit(
            "state_dict does not match the current model definition.\n"
            "Most likely config.py's anchor settings differ from the ones the "
            "checkpoint was trained with (see DEPLOYMENT.md)."
        )
    model.eval()
    print(f"loaded {checkpoint_path} (epoch {epoch})")
    return model


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
def export(model, out_path, opset=16, score_thresh=config.SCORE_THRESH):
    wrapper = ONNXFasterRCNN(model, score_thresh=score_thresh).eval()
    dummy = torch.randn(1, 3, config.IMG_SIZE, config.IMG_SIZE)

    dyn = {"boxes":  {0: "num_detections"},
           "labels": {0: "num_detections"},
           "scores": {0: "num_detections"}}
    kwargs = dict(
        input_names=["images"],
        output_names=["boxes", "labels", "scores"],
        dynamic_axes=dyn,
        opset_version=opset,
        do_constant_folding=True,
    )

    with torch.no_grad(), warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=torch.jit.TracerWarning)
        warnings.filterwarnings("ignore", category=UserWarning)
        try:
            # dynamo=False forces the TorchScript exporter, which is the one
            # torchvision registers its nms / roi_align symbolics against.
            torch.onnx.export(wrapper, (dummy,), out_path, dynamo=False, **kwargs)
        except TypeError:
            torch.onnx.export(wrapper, (dummy,), out_path, **kwargs)

    size_mb = os.path.getsize(out_path) / 1e6
    print(f"exported -> {out_path}  ({size_mb:.1f} MB, opset {opset})")
    return wrapper


# ---------------------------------------------------------------------------
# Verification: PyTorch eager vs ONNX Runtime
# ---------------------------------------------------------------------------
def verify(model, wrapper, onnx_path, image=None, tol=1e-3):
    try:
        import numpy as np
        import onnx
        import onnxruntime as ort
    except ImportError as e:
        print(f"skipping verification ({e}); pip install onnx onnxruntime")
        return

    onnx.checker.check_model(onnx.load(onnx_path))
    print("onnx.checker: OK")

    if image:
        import cv2
        from inference import preprocess
        img = cv2.imread(image)
        if img is None:
            raise FileNotFoundError(image)
        x, _ = preprocess(img)
        print(f"verifying on {image}")
    else:
        torch.manual_seed(0)
        x = torch.randn(1, 3, config.IMG_SIZE, config.IMG_SIZE)
        print("verifying on a random tensor")

    with torch.no_grad():
        ref = model(x)[0]                       # original eval path
        wrp = wrapper(x)                        # traceable wrapper, eager

    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    o_boxes, o_labels, o_scores = sess.run(None, {"images": x.numpy()})

    def report(name, a_boxes, a_labels, a_scores):
        a_boxes = np.asarray(a_boxes); a_scores = np.asarray(a_scores)
        b_boxes, b_labels, b_scores = o_boxes, o_labels, o_scores
        print(f"  {name:22s} n={len(a_scores):<4d} vs onnx n={len(b_scores)}")
        if len(a_scores) != len(b_scores):
            print("    ! detection counts differ")
            return False
        if len(a_scores) == 0:
            return True
        # both paths return score-descending, so a positional compare is valid
        db = float(np.abs(a_boxes - b_boxes).max())
        ds = float(np.abs(a_scores - b_scores).max())
        dl = int((np.asarray(a_labels) != b_labels).sum())
        print(f"    max |dbox|={db:.5f}  max |dscore|={ds:.6f}  label mismatches={dl}")
        return db < 1.0 and ds < tol and dl == 0

    ok_w = report("wrapper (eager)",
                  wrp[0].numpy(), wrp[1].numpy(), wrp[2].numpy())
    ok_r = report("original FasterRCNN",
                  ref["boxes"].numpy(), ref["labels"].numpy(), ref["scores"].numpy())

    if ok_w and ok_r:
        print("VERIFICATION PASSED")
    elif ok_w:
        print("ONNX matches the wrapper, but the wrapper differs from the "
              "original model.\nOn a random tensor this is usually harmless "
              "(an untrained-looking input produces near-tied scores whose NMS "
              "order is arbitrary). Re-run with --image on a real photo before "
              "worrying.")
    else:
        print("VERIFICATION FAILED -- ONNX and PyTorch disagree.")


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Export the Faster R-CNN .pth to ONNX")
    ap.add_argument("--checkpoint", default=f"{config.CKPT_DIR}/tuned_fixed/best.pth",
                    help="path to the .pth checkpoint")
    ap.add_argument("--out", default=None,
                    help="output .onnx path (default: alongside the checkpoint)")
    ap.add_argument("--opset", type=int, default=16,
                    help="ONNX opset (16+ recommended: RoiAlign + NonMaxSuppression)")
    ap.add_argument("--score", type=float, default=config.SCORE_THRESH,
                    help="score threshold baked into the graph")
    ap.add_argument("--image", default=None,
                    help="verify against this image instead of a random tensor")
    ap.add_argument("--no-verify", action="store_true")
    args = ap.parse_args()

    if not os.path.isfile(args.checkpoint):
        sys.exit(f"checkpoint not found: {args.checkpoint}")

    out = args.out or os.path.splitext(args.checkpoint)[0] + ".onnx"
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)

    model = load_model(args.checkpoint, "cpu")
    wrapper = export(model, out, opset=args.opset, score_thresh=args.score)

    if not args.no_verify:
        verify(model, wrapper, out, image=args.image)

    print("\ninput : images  float32 [1,3,%d,%d]  (RGB, /255, "
          "normalized with config.NORM_MEAN/STD)" % (config.IMG_SIZE, config.IMG_SIZE))
    print("output: boxes  float32 [D,4]  xyxy in 640x640 model space")
    print("        labels int64   [D]    %s" % dict(enumerate(config.MODEL_LABELS)))
    print("        scores float32 [D]")


if __name__ == "__main__":
    main()
