"""Burns real analysis results onto a video frame (Phase G2).

Pure drawing: given one decoded frame and the nearest analysed
:class:`~app.domain.video_analysis.FrameSample`, paint the same information
the frontend already overlays live (detection boxes, driver state, fatigue
score) directly onto the pixels, so the encoded output is a genuine,
shareable artifact rather than something only meaningful inside the app.

Frames between actual AI samples are not re-analysed - that is exactly what
:mod:`app.services.video_analysis_service` avoids, since it is the expensive
part. They hold the nearest real sample's overlay instead, the same
nearest-timestamp approach the live browser overlay already uses
(``EnhancedVideoPlayer.jsx``). This module only draws; it never invents a
detection that was not actually produced by the model.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.constants import AlertLevel, DriverState

if TYPE_CHECKING:
    import numpy as np

    from app.domain.video_analysis import FrameSample

# BGR (OpenCV's channel order, not RGB) per driver state, for the HUD text and
# its background chip. Chosen to be distinguishable at a glance, not tied to
# the frontend's OKLCH palette (a different colour space serving a different
# renderer).
_STATE_COLOR_BGR: dict[DriverState, tuple[int, int, int]] = {
    DriverState.AWAKE: (90, 200, 60),
    DriverState.YAWNING: (0, 200, 255),
    DriverState.DROWSY: (0, 140, 255),
    DriverState.SLEEPING: (0, 0, 255),
    DriverState.UNKNOWN: (160, 160, 160),
}

# Per-label box colour, so closed-eye/open-eye/yawn evidence is visually
# distinct on the frame even when the overall state does not change.
_LABEL_COLOR_BGR: dict[str, tuple[int, int, int]] = {
    "closed_eye": (0, 0, 255),
    "open_eye": (90, 200, 60),
    "yawn": (0, 140, 255),
}
_DEFAULT_LABEL_COLOR_BGR = (160, 160, 160)


def draw_overlay(frame_bgr: np.ndarray, sample: FrameSample | None) -> None:
    """Draw detection boxes and a state/fatigue HUD onto a frame, in place.

    A no-op when ``sample`` is ``None`` - the handful of frames before the
    first analysed sample are left unannotated rather than guessing.

    Args:
        frame_bgr: One decoded frame, OpenCV's native ``H x W x 3`` BGR
            array. Mutated directly; the caller owns the write to the
            encoder afterwards.
        sample: The nearest analysed frame's result, or ``None``.
    """
    if sample is None:
        return

    import cv2

    width = frame_bgr.shape[1]
    scale = max(0.4, min(1.1, width / 960))
    thickness = max(1, round(scale * 2))

    for det in sample.analysis.detections:
        color = _LABEL_COLOR_BGR.get(det.label, _DEFAULT_LABEL_COLOR_BGR)
        x1, y1, x2, y2 = round(det.x1), round(det.y1), round(det.x2), round(det.y2)
        cv2.rectangle(frame_bgr, (x1, y1), (x2, y2), color, thickness)
        label = f"{det.label} {det.score:.2f}"
        text_y = max(0, y1 - 6)
        cv2.putText(
            frame_bgr, label, (x1, text_y), cv2.FONT_HERSHEY_SIMPLEX, scale * 0.5, color, thickness
        )

    state = sample.analysis.driver_state
    level = sample.analysis.alert_level
    state_color = _STATE_COLOR_BGR.get(state, _STATE_COLOR_BGR[DriverState.UNKNOWN])
    hud_text = f"{state.api_label} - {level.api_label}"
    if level is not AlertLevel.NONE:
        hud_text = f"{state.api_label} - {level.api_label} ALERT"

    padding = round(8 * scale)
    (text_width, text_height), _ = cv2.getTextSize(
        hud_text, cv2.FONT_HERSHEY_SIMPLEX, scale * 0.6, thickness
    )
    box_end = (padding * 2 + text_width, padding * 3 + text_height)
    cv2.rectangle(frame_bgr, (0, 0), box_end, (0, 0, 0), -1)
    cv2.rectangle(frame_bgr, (0, 0), box_end, state_color, thickness)
    cv2.putText(
        frame_bgr,
        hud_text,
        (padding, padding + text_height),
        cv2.FONT_HERSHEY_SIMPLEX,
        scale * 0.6,
        state_color,
        thickness,
    )
