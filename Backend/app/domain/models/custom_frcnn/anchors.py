"""Anchor box generation, in image pixel coordinates.

Ported unchanged from ``ML/models/anchors.py``.
"""

from __future__ import annotations

import torch


def generate_base_anchors(scales: list[int], ratios: list[float]) -> torch.Tensor:
    """Build the anchor shapes centered at (0, 0). Returns ``[A, 4]`` as x1,y1,x2,y2."""
    anchors = []
    for scale in scales:
        area = scale * scale
        for ratio in ratios:
            w = (area / ratio) ** 0.5
            h = w * ratio
            anchors.append([-w / 2, -h / 2, w / 2, h / 2])
    return torch.tensor(anchors, dtype=torch.float32)


def generate_anchors(
    feature_size: int,
    stride: int,
    scales: list[int],
    ratios: list[float],
    device: str = "cpu",
) -> torch.Tensor:
    """Tile the base anchors across every feature-map cell.

    Returns ``[feature_size * feature_size * A, 4]`` in image pixels.
    """
    base = generate_base_anchors(scales, ratios).to(device)

    shifts = (torch.arange(feature_size, device=device) + 0.5) * stride
    cy, cx = torch.meshgrid(shifts, shifts, indexing="ij")
    centers = torch.stack([cx.reshape(-1), cy.reshape(-1), cx.reshape(-1), cy.reshape(-1)], dim=1)

    anchors = centers[:, None, :] + base[None, :, :]
    return anchors.reshape(-1, 4)
