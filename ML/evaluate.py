"""Validation evaluation for the drowsiness Faster R-CNN."""
import torch
from utils.metrics import evaluate_detections, compute_map_range

@torch.no_grad()
def evaluate(model, loader, device, iou_thresh=0.5):
    was_training = model.training
    model.eval()
    all_preds, all_gts = [], []
    for images, targets in loader:
        images = images.to(device)
        detections = model(images)
        for det, tgt in zip(detections, targets):
            all_preds.append({k: v.cpu() for k, v in det.items()})
            all_gts.append({"boxes": tgt["boxes"], "labels": tgt["labels"]})

    metrics = evaluate_detections(all_preds, all_gts, iou_thresh=iou_thresh)
    metrics["mAP@0.5:0.95"] = compute_map_range(all_preds, all_gts)
    if was_training:
        model.train()
    return metrics

if __name__ == "__main__":
    from utils.metrics import evaluate_detections
    preds = [{"boxes": torch.tensor([[10., 10, 50, 50]]), "labels": torch.tensor([1]), "scores": torch.tensor([0.9])}]
    gts = [{"boxes": torch.tensor([[11., 11, 49, 49]]), "labels": torch.tensor([1])}]
    m = evaluate_detections(preds, gts)
    print("mAP@0.5:", round(m["mAP@0.5"], 3), "precision:", round(m["precision"], 3))
    assert m["mAP@0.5"] > 0.99
    print("SELF-TEST PASSED")
