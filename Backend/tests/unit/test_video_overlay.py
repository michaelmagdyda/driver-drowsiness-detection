"""Unit tests for :mod:`app.services.video_overlay`.

Pure drawing onto a real OpenCV array - no I/O, no ffmpeg - so correctness is
checked the same way any pixel-mutating function is: did the expected region
of the array actually change.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.core.constants import AlertLevel, DriverState
from app.domain.analysis import AnalyzedDetection, DerivedMetrics, FrameAnalysis
from app.domain.video_analysis import FrameSample
from app.services.video_overlay import draw_overlay

pytestmark = pytest.mark.unit


def _blank_frame(width: int = 320, height: int = 240) -> np.ndarray:
    return np.zeros((height, width, 3), dtype=np.uint8)


def _sample_with_detection() -> FrameSample:
    detection = AnalyzedDetection(
        label="open_eye", label_index=2, score=0.91, x1=40, y1=40, x2=120, y2=100
    )
    analysis = FrameAnalysis(
        driver_state=DriverState.AWAKE,
        alert_level=AlertLevel.NONE,
        fatigue_score=0.1,
        detections=[detection],
        metrics=DerivedMetrics(
            eye_aspect_ratio=0.9, mouth_aspect_ratio=None, eyes_closed=False, yawning=False
        ),
    )
    return FrameSample(t=1.0, analysis=analysis)


class TestDrawOverlay:
    def test_none_sample_leaves_frame_untouched(self) -> None:
        frame = _blank_frame()
        draw_overlay(frame, None)
        assert not frame.any()

    def test_draws_something_for_a_real_sample(self) -> None:
        frame = _blank_frame()
        draw_overlay(frame, _sample_with_detection())
        assert frame.any()

    def test_box_region_is_modified(self) -> None:
        frame = _blank_frame()
        draw_overlay(frame, _sample_with_detection())
        # The detection box was (40,40)-(120,100); its border should now be
        # non-zero somewhere along the top edge.
        assert frame[40, 40:120].any()

    def test_hud_corner_is_modified_even_with_no_detections(self) -> None:
        analysis = FrameAnalysis(
            driver_state=DriverState.SLEEPING,
            alert_level=AlertLevel.HIGH,
            fatigue_score=0.9,
            detections=[],
            metrics=DerivedMetrics(
                eye_aspect_ratio=None, mouth_aspect_ratio=None, eyes_closed=True, yawning=False
            ),
        )
        sample = FrameSample(t=0.5, analysis=analysis)
        frame = _blank_frame()
        draw_overlay(frame, sample)
        # The HUD chip is drawn in the top-left corner regardless of detections.
        assert frame[0:20, 0:20].any()

    def test_does_not_crash_on_a_tiny_frame(self) -> None:
        frame = _blank_frame(width=16, height=16)
        draw_overlay(frame, _sample_with_detection())
        assert frame.any()
