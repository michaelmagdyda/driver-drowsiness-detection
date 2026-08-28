"""
train.py
--------
Train the simplified Faster R-CNN.

New experiment features:
- Optimizer selectable from config: AdamW or SGD
- Scheduler selectable from config: cosine (+ warmup), plateau, or step
- Optional gradient clipping
- CSV logging of the 4 losses, total loss, val mAP@0.5,
  val mAP@0.5:0.95 (when evaluate() provides it), and learning rate
- Resume-safe optimizer/scheduler checkpoints
"""

import os
import csv
import math
import argparse
import torch
from torch.utils.data import DataLoader

import config
from dataset import make_splits, load_split, DrowsinessDataset, collate_fn
from models.faster_rcnn import FasterRCNN
from utils.gpu_utils import select_device, print_gpu_memory, clear_cache
from utils.onnx_export import export_onnx, copy_best_onnx
from evaluate import evaluate


def move_targets(targets, device):
    return [{"boxes": t["boxes"].to(device),
             "labels": t["labels"].to(device),
             "image_id": t["image_id"]} for t in targets]


def train_one_epoch(model, loader, optimizer, device, epoch):
    model.train()
    running = {
        "rpn_obj_loss": 0.0,
        "rpn_box_loss": 0.0,
        "det_cls_loss": 0.0,
        "det_box_loss": 0.0,
        "total": 0.0,
    }

    grad_clip = getattr(config, "GRAD_CLIP_NORM", 0)

    for i, (images, targets) in enumerate(loader):
        images = images.to(device)
        targets = move_targets(targets, device)

        losses = model(images, targets)
        total = sum(losses.values())

        optimizer.zero_grad(set_to_none=True)
        total.backward()

        if grad_clip:
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=grad_clip)

        optimizer.step()

        for k in losses:
            running[k] += losses[k].item()
        running["total"] += total.item()

        if i % 20 == 0:
            msg = " | ".join(f"{k}:{v.item():.3f}" for k, v in losses.items())
            print(f"  epoch {epoch} [{i}/{len(loader)}] {msg} | total:{total.item():.3f}")

    n = max(len(loader), 1)
    return {k: v / n for k, v in running.items()}


def build_optimizer(model, lr):
    name = config.OPTIMIZER.lower()

    if name == "adamw":
        optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=lr,
            weight_decay=config.WEIGHT_DECAY,
        )
    elif name == "sgd":
        optimizer = torch.optim.SGD(
            model.parameters(),
            lr=lr,
            momentum=config.MOMENTUM,
            weight_decay=config.WEIGHT_DECAY,
        )
    else:
        raise ValueError(f"Unknown OPTIMIZER='{config.OPTIMIZER}'. Use 'adamw' or 'sgd'.")

    print(f"[optim] {name.upper()} | lr={lr:g} | weight_decay={config.WEIGHT_DECAY:g}")
    return optimizer


def build_scheduler(optimizer, total_epochs):
    name = config.LR_SCHEDULER.lower()

    if name == "plateau":
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer,
            mode="max",
            factor=config.PLATEAU_FACTOR,
            patience=config.PLATEAU_PATIENCE,
            min_lr=config.PLATEAU_MIN_LR,
        )
        print(f"[sched] ReduceLROnPlateau(mode=max, factor={config.PLATEAU_FACTOR}, "
              f"patience={config.PLATEAU_PATIENCE}, min_lr={config.PLATEAU_MIN_LR})")
        return scheduler, "plateau"

    if name == "step":
        scheduler = torch.optim.lr_scheduler.StepLR(
            optimizer,
            step_size=config.LR_STEP,
            gamma=config.LR_GAMMA,
        )
        print(f"[sched] StepLR(step={config.LR_STEP}, gamma={config.LR_GAMMA})")
        return scheduler, "epoch"

    if name == "cosine":
        warmup_epochs = max(0, int(getattr(config, "WARMUP_EPOCHS", 0)))
        min_lr = float(getattr(config, "COSINE_MIN_LR", 1e-6))
        base_lr = optimizer.param_groups[0]["lr"]

        # LambdaLR gives one resume-safe scheduler state and supports a linear
        # warmup followed by cosine decay down to COSINE_MIN_LR.
        def lr_lambda(epoch_index):
            # epoch_index is zero-based scheduler progress.
            current_epoch = epoch_index + 1

            if warmup_epochs > 0 and current_epoch <= warmup_epochs:
                return current_epoch / warmup_epochs

            cosine_epochs = max(total_epochs - warmup_epochs, 1)
            progress = (current_epoch - warmup_epochs) / cosine_epochs
            progress = min(max(progress, 0.0), 1.0)

            min_factor = min_lr / base_lr
            cosine_factor = 0.5 * (1.0 + math.cos(math.pi * progress))
            return min_factor + (1.0 - min_factor) * cosine_factor

        scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda=lr_lambda)
        print(f"[sched] Warmup+Cosine | warmup={warmup_epochs} epochs | "
              f"min_lr={min_lr:g} | total_epochs={total_epochs}")
        return scheduler, "epoch"

    raise ValueError(
        f"Unknown LR_SCHEDULER='{config.LR_SCHEDULER}'. "
        "Use 'cosine', 'plateau', or 'step'."
    )


def get_map_50_95(metrics):
    """Accept common key spellings without breaking an existing evaluator."""
    for key in ("mAP@0.5:0.95", "mAP@0.5:0.95", "mAP50-95", "map_50_95"):
        if key in metrics:
            return float(metrics[key])
    return float("nan")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default=None, help="cuda:0, cuda:1, cpu, or auto")
    ap.add_argument("--epochs", type=int, default=config.NUM_EPOCHS)
    ap.add_argument("--batch-size", type=int, default=config.BATCH_SIZE)
    ap.add_argument("--lr", type=float, default=config.LR)
    ap.add_argument("--run-name", default="adamw_cosine_v1",
                    help="tag for this run; checkpoints -> checkpoints/<run-name>/, "
                         "log -> results/train_log_<run-name>.csv")
    ap.add_argument("--vram-fraction", type=float, default=None,
                    help="cap GPU memory this process may use, e.g. 0.7 for 70%%")
    ap.add_argument("--resume", nargs="?", const="__AUTO__", default=None,
                    help="resume training; optionally a checkpoint path "
                         "(default: this run's checkpoints/<run-name>/last.pth)")
    args = ap.parse_args()

    device = select_device(args.device)

    ckpt_dir = os.path.join(config.CKPT_DIR, args.run_name)
    os.makedirs(ckpt_dir, exist_ok=True)
    os.makedirs(config.RESULTS_DIR, exist_ok=True)
    log_path = os.path.join(config.RESULTS_DIR, f"train_log_{args.run_name}.csv")
    print(f"[run] '{args.run_name}' | checkpoints -> {ckpt_dir} | log -> {log_path}")

    if args.vram_fraction is not None and device.type == "cuda":
        torch.cuda.set_per_process_memory_fraction(args.vram_fraction, device.index or 0)
        print(f"[gpu] VRAM limited to {args.vram_fraction:.0%} of device memory")

    make_splits()
    train_ds = DrowsinessDataset(load_split(f"{config.SPLITS_DIR}/train.txt"), train=True)
    val_ds = DrowsinessDataset(load_split(f"{config.SPLITS_DIR}/val.txt"), train=False)
    train_loader = DataLoader(
        train_ds, batch_size=args.batch_size, shuffle=True,
        collate_fn=collate_fn, num_workers=4
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.batch_size, shuffle=False,
        collate_fn=collate_fn, num_workers=4
    )
    print(f"train images: {len(train_ds)} | val images: {len(val_ds)}")

    model = FasterRCNN().to(device)
    optimizer = build_optimizer(model, args.lr)
    scheduler, scheduler_mode = build_scheduler(optimizer, args.epochs)

    best_map = -1.0
    start_epoch = 0
    epochs_no_improve = 0

    resume_path = args.resume
    if resume_path == "__AUTO__":
        resume_path = os.path.join(ckpt_dir, "last.pth")

    if resume_path is not None:
        if not os.path.exists(resume_path):
            raise FileNotFoundError(f"--resume checkpoint not found: {resume_path}")

        ckpt = torch.load(resume_path, map_location=device)
        model.load_state_dict(ckpt["model"])
        start_epoch = ckpt.get("epoch", 0)
        best_map = ckpt.get("best_mAP", ckpt.get("mAP", -1.0))
        epochs_no_improve = ckpt.get("epochs_no_improve", 0)

        if "optimizer" in ckpt:
            optimizer.load_state_dict(ckpt["optimizer"])
        if "scheduler" in ckpt:
            try:
                scheduler.load_state_dict(ckpt["scheduler"])
            except Exception as e:
                print(f"[resume] warning: scheduler state not loaded: {e}")

        best_path = os.path.join(ckpt_dir, "best.pth")
        if os.path.exists(best_path):
            try:
                old_best = torch.load(best_path, map_location="cpu")
                best_map = max(best_map, old_best.get("best_mAP", old_best.get("mAP", -1.0)))
            except Exception:
                pass

        print(f"[resume] loaded {resume_path} -> continuing from epoch {start_epoch + 1} "
              f"(best mAP@0.5 so far {best_map:.4f})")

    for epoch in range(start_epoch + 1, args.epochs + 1):
        print(f"\n=== Epoch {epoch}/{args.epochs} ===")
        train_lr = optimizer.param_groups[0]["lr"]
        print(f"  [lr/train] {train_lr:.2e}")

        losses = train_one_epoch(model, train_loader, optimizer, device, epoch)
        print("  avg:", " | ".join(f"{k}:{v:.3f}" for k, v in losses.items()))
        print_gpu_memory(device)

        metrics = evaluate(model, val_loader, device)
        val_map_50 = float(metrics["mAP@0.5"])
        val_map_50_95 = get_map_50_95(metrics)

        if math.isnan(val_map_50_95):
            print(f"  [val] mAP@0.5 = {val_map_50:.4f} | mAP@0.5:0.95 = N/A (not returned by evaluate.py)")
        else:
            print(f"  [val] mAP@0.5 = {val_map_50:.4f} | mAP@0.5:0.95 = {val_map_50_95:.4f}")

        # Scheduler update happens after validation. The CSV records both the LR
        # actually used for this epoch and the LR prepared for the next epoch.
        if scheduler_mode == "plateau":
            scheduler.step(val_map_50)
        else:
            scheduler.step()
        next_lr = optimizer.param_groups[0]["lr"]
        print(f"  [lr/next]  {next_lr:.2e}")

        write_header = not os.path.exists(log_path) or os.path.getsize(log_path) == 0
        with open(log_path, "a", newline="") as f:
            w = csv.writer(f)
            if write_header:
                w.writerow([
                    "epoch",
                    "rpn_obj_loss",
                    "rpn_box_loss",
                    "det_cls_loss",
                    "det_box_loss",
                    "total_loss",
                    "val_map_50",
                    "val_map_50_95",
                    "train_lr",
                    "next_lr",
                ])
            w.writerow([
                epoch,
                f"{losses['rpn_obj_loss']:.6f}",
                f"{losses['rpn_box_loss']:.6f}",
                f"{losses['det_cls_loss']:.6f}",
                f"{losses['det_box_loss']:.6f}",
                f"{losses['total']:.6f}",
                f"{val_map_50:.6f}",
                "nan" if math.isnan(val_map_50_95) else f"{val_map_50_95:.6f}",
                f"{train_lr:.10f}",
                f"{next_lr:.10f}",
            ])

        improved = val_map_50 > best_map
        if improved:
            best_map = val_map_50
            epochs_no_improve = 0
        else:
            epochs_no_improve += 1

        checkpoint = {
            "model": model.state_dict(),
            "epoch": epoch,
            "mAP": val_map_50,               # backward-compatible key
            "best_mAP": best_map,
            "mAP@0.5": val_map_50,
            "mAP@0.5:0.95": val_map_50_95,
            "epochs_no_improve": epochs_no_improve,
            "optimizer_name": config.OPTIMIZER,
            "scheduler_name": config.LR_SCHEDULER,
            "optimizer": optimizer.state_dict(),
            "scheduler": scheduler.state_dict(),
        }
        torch.save(checkpoint, os.path.join(ckpt_dir, "last.pth"))

        last_onnx_path = os.path.join(ckpt_dir, "last.onnx")
        if getattr(config, "EXPORT_ONNX", False):
            export_onnx(model, last_onnx_path, device)

        if improved:
            torch.save(checkpoint, os.path.join(ckpt_dir, "best.pth"))
            if getattr(config, "EXPORT_ONNX", False):
                copy_best_onnx(last_onnx_path, os.path.join(ckpt_dir, "best.onnx"))
            print(f"  saved new best (mAP@0.5 = {best_map:.4f})")
        else:
            print(f"  no improvement for {epochs_no_improve} epoch(s) "
                  f"(best {best_map:.4f})")

        clear_cache(device)

        if (config.EARLY_STOP_PATIENCE and
                epochs_no_improve >= config.EARLY_STOP_PATIENCE):
            print(f"\n[early-stop] val mAP@0.5 has not improved for "
                  f"{epochs_no_improve} epochs "
                  f"(patience={config.EARLY_STOP_PATIENCE}). Stopping at epoch {epoch}.")
            break

    print(f"\nTraining done. Best val mAP@0.5 = {best_map:.4f}")
    print(f"  best model: {os.path.join(ckpt_dir, 'best.pth')}")
    if getattr(config, "EXPORT_ONNX", False):
        print(f"  best ONNX:  {os.path.join(ckpt_dir, 'best.onnx')}")
    print(f"  CSV log:    {log_path}")


if __name__ == "__main__":
    main()
