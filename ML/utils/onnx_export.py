"""ONNX export helpers for the custom Faster R-CNN detector."""

import os
import shutil

import torch
import torch.nn as nn

import config


class ONNXInferenceWrapper(nn.Module):
    """Expose the single-image detections as three ordinary ONNX tensors."""

    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, images):
        result = self.model(images)[0]
        return result["boxes"], result["labels"], result["scores"]


def export_onnx(model, output_path, device):
    """Export a batch-1 inference graph without changing the model's mode."""
    try:
        import onnx  # noqa: F401 - torch's legacy exporter requires this package
    except ImportError as exc:
        raise RuntimeError(
            "ONNX export is enabled but the 'onnx' package is not installed. "
            "Install project requirements, or set EXPORT_ONNX=False in config.py."
        ) from exc

    was_training = model.training
    model.eval()
    wrapper = ONNXInferenceWrapper(model)
    dummy = torch.zeros(1, 3, config.IMG_SIZE, config.IMG_SIZE, device=device)
    temporary_path = output_path + ".tmp"

    try:
        with torch.no_grad():
            torch.onnx.export(
                wrapper,
                dummy,
                temporary_path,
                export_params=True,
                opset_version=int(getattr(config, "ONNX_OPSET", 17)),
                do_constant_folding=True,
                input_names=["images"],
                output_names=["boxes", "labels", "scores"],
                dynamic_axes={
                    "boxes": {0: "num_detections"},
                    "labels": {0: "num_detections"},
                    "scores": {0: "num_detections"},
                },
                # The legacy exporter supports this model's torchvision RoI/NMS
                # operators and only requires the lightweight `onnx` package.
                dynamo=False,
            )
        os.replace(temporary_path, output_path)
    finally:
        if os.path.exists(temporary_path):
            os.remove(temporary_path)
        model.train(was_training)

    print(f"  exported ONNX: {output_path}")


def copy_best_onnx(last_path, best_path):
    """The best and last weights are identical on an improving epoch."""
    shutil.copy2(last_path, best_path)
    print(f"  updated best ONNX: {best_path}")
