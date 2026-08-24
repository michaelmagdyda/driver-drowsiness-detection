"""Custom CNN backbone (no pretrained weights).

Ported unchanged from ``ML/models/backbone.py``: four conv blocks, each
halving spatial size, for a total stride of 16.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import torch.nn as nn

from app.domain.models.custom_frcnn._geometry import BACKBONE_STRIDE

if TYPE_CHECKING:
    import torch


def conv_block(in_ch: int, out_ch: int) -> nn.Sequential:
    """One backbone stage: two 3x3 conv-BN-ReLU layers, then a 2x2 max-pool."""
    return nn.Sequential(
        nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
        nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
        nn.MaxPool2d(kernel_size=2, stride=2),
    )


class BackboneCNN(nn.Module):
    """Image -> feature map, downsampled by :data:`BACKBONE_STRIDE`."""

    def __init__(self) -> None:
        """Build the four downsampling conv blocks."""
        super().__init__()
        self.block1 = conv_block(3, 64)
        self.block2 = conv_block(64, 128)
        self.block3 = conv_block(128, 256)
        self.block4 = conv_block(256, 256)

        self.out_channels = 256
        self.stride = BACKBONE_STRIDE

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """``[B,3,H,W]`` -> ``[B,256,H/16,W/16]``."""
        x = self.block1(x)
        x = self.block2(x)
        x = self.block3(x)
        return self.block4(x)
