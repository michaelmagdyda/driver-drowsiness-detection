"""
onnx_inference.py
-----------------
Run the exported ONNX detector on an image -- a drop-in replacement for
inference.py that needs onnxruntime instead of torch.

Usage:
    python onnx_inference.py --image path/to/img.jpg \
                             --model checkpoints/tuned_fixed/best.onnx \
                             --out result.jpg

The preprocessing here is byte-for-byte the same as inference.preprocess(),
and the boxes come back in the same coordinate space, so anything downstream
(utils/driver_state.py, app.py, the FastAPI service) can swap in unchanged.
"""

import argparse

import cv2
import numpy as np
import onnxruntime as ort

import config

# labels the model was trained with, index -> name
LABELS = config.MODEL_LABELS


def preprocess(img_bgr):
    """BGR image -> (float32 [1,3,640,640], (scale_x, scale_y))."""
    H0, W0 = img_bgr.shape[:2]
    img = cv2.resize(img_bgr, (config.IMG_SIZE, config.IMG_SIZE))
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = img.transpose(2, 0, 1)                                   # HWC -> CHW
    mean = np.array(config.NORM_MEAN, dtype=np.float32).reshape(3, 1, 1)
    std = np.array(config.NORM_STD, dtype=np.float32).reshape(3, 1, 1)
    x = (x - mean) / std
    return x[None].astype(np.float32), (W0 / config.IMG_SIZE, H0 / config.IMG_SIZE)


class OnnxDetector:
    def __init__(self, model_path, providers=None):
        providers = providers or ["CPUExecutionProvider"]
        so = ort.SessionOptions()
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, so, providers=providers)
        self.input_name = self.session.get_inputs()[0].name

    def detect(self, img_bgr, score_thresh=config.SCORE_THRESH):
        """
        Returns (boxes [D,4] xyxy in ORIGINAL image pixels, labels [D], scores [D]).
        """
        x, (sx, sy) = preprocess(img_bgr)
        boxes, labels, scores = self.session.run(None, {self.input_name: x})

        # the graph already applies config.SCORE_THRESH; this allows raising it
        keep = scores >= score_thresh
        boxes, labels, scores = boxes[keep], labels[keep], scores[keep]

        boxes = boxes.copy()
        boxes[:, [0, 2]] *= sx
        boxes[:, [1, 3]] *= sy
        return boxes, labels, scores


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--model", default=f"{config.CKPT_DIR}/tuned_fixed/best.onnx")
    ap.add_argument("--out", default="result_onnx.jpg")
    ap.add_argument("--score", type=float, default=config.SCORE_THRESH)
    args = ap.parse_args()

    img = cv2.imread(args.image)
    if img is None:
        raise FileNotFoundError(args.image)

    det = OnnxDetector(args.model)
    boxes, labels, scores = det.detect(img, args.score)

    for lab, sc in zip(labels, scores):
        print(f"  {LABELS[int(lab)]}: {int(sc * 100)}%")

    try:
        from utils.visualization import draw_detections
        draw_detections(img, boxes, labels, scores)
    except Exception:
        for (x1, y1, x2, y2), lab, sc in zip(boxes, labels, scores):
            cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
            cv2.putText(img, f"{LABELS[int(lab)]} {sc:.2f}", (int(x1), int(y1) - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

    cv2.imwrite(args.out, img)
    print(f"saved -> {args.out}")


if __name__ == "__main__":
    main()
