"""Unit tests for :mod:`app.domain.video_analysis`.

Pure aggregation logic - no I/O, no FastAPI, no OpenCV - so every case builds
synthetic :class:`FrameAnalysis` sequences directly rather than going through
a real video.
"""

from __future__ import annotations

from app.core.constants import AlertLevel, DriverState
from app.domain.analysis import AnalyzedDetection, DerivedMetrics, FrameAnalysis
from app.domain.video_analysis import FrameSample, aggregate_video


def _frame(
    *,
    state: DriverState,
    level: AlertLevel,
    fatigue: float,
    eyes_closed: bool = False,
    yawning: bool = False,
    ear: float | None = None,
    mar: float | None = None,
    detections: list[AnalyzedDetection] | None = None,
) -> FrameAnalysis:
    return FrameAnalysis(
        driver_state=state,
        alert_level=level,
        fatigue_score=fatigue,
        detections=detections or [],
        metrics=DerivedMetrics(
            eye_aspect_ratio=ear,
            mouth_aspect_ratio=mar,
            eyes_closed=eyes_closed,
            yawning=yawning,
        ),
    )


def _samples(*frames: tuple[float, FrameAnalysis]) -> list[FrameSample]:
    return [FrameSample(t=t, analysis=analysis) for t, analysis in frames]


def _det(score: float) -> AnalyzedDetection:
    return AnalyzedDetection(label="closed_eye", label_index=1, score=score, x1=0, y1=0, x2=1, y2=1)


class TestAggregateVideo:
    def test_empty_frames_returns_unknown_baseline(self) -> None:
        result = aggregate_video(
            [],
            duration_sec=10.0,
            width=640,
            height=480,
            source_fps=30.0,
            source_frame_count=300,
            sample_fps=2.0,
        )

        assert result.driver_state is DriverState.UNKNOWN
        assert result.fatigue_score == 0.0
        assert result.max_fatigue_score == 0.0
        assert result.total_yawns == 0
        assert result.longest_eye_closure_sec == 0.0
        assert result.avg_eye_aspect_ratio is None
        assert result.avg_confidence is None
        assert result.total_alerts == 0
        assert result.distribution == []
        assert result.timeline == []

    def test_worst_state_wins_over_awake(self) -> None:
        frames = _samples(
            (0.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.05)),
            (
                0.5,
                _frame(
                    state=DriverState.SLEEPING, level=AlertLevel.HIGH, fatigue=0.9, eyes_closed=True
                ),
            ),
            (1.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.05)),
        )
        result = aggregate_video(
            frames,
            duration_sec=1.5,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=3,
            sample_fps=2.0,
        )
        assert result.driver_state is DriverState.SLEEPING

    def test_worst_state_ignores_unknown_when_evidence_exists(self) -> None:
        frames = _samples(
            (0.0, _frame(state=DriverState.UNKNOWN, level=AlertLevel.NONE, fatigue=0.0)),
            (
                0.5,
                _frame(state=DriverState.YAWNING, level=AlertLevel.LOW, fatigue=0.5, yawning=True),
            ),
        )
        result = aggregate_video(
            frames,
            duration_sec=1.0,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=2,
            sample_fps=2.0,
        )
        assert result.driver_state is DriverState.YAWNING

    def test_all_unknown_frames_reports_unknown(self) -> None:
        frames = _samples(
            (0.0, _frame(state=DriverState.UNKNOWN, level=AlertLevel.NONE, fatigue=0.0)),
            (0.5, _frame(state=DriverState.UNKNOWN, level=AlertLevel.NONE, fatigue=0.0)),
        )
        result = aggregate_video(
            frames,
            duration_sec=1.0,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=2,
            sample_fps=2.0,
        )
        assert result.driver_state is DriverState.UNKNOWN

    def test_total_yawns_counts_onsets_not_raw_frames(self) -> None:
        # Two separate yawns, each spanning two consecutive sampled frames.
        frames = _samples(
            (0.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
            (
                0.5,
                _frame(state=DriverState.YAWNING, level=AlertLevel.LOW, fatigue=0.5, yawning=True),
            ),
            (
                1.0,
                _frame(state=DriverState.YAWNING, level=AlertLevel.LOW, fatigue=0.5, yawning=True),
            ),
            (1.5, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
            (
                2.0,
                _frame(state=DriverState.YAWNING, level=AlertLevel.LOW, fatigue=0.5, yawning=True),
            ),
        )
        result = aggregate_video(
            frames,
            duration_sec=2.5,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=5,
            sample_fps=2.0,
        )
        assert result.total_yawns == 2

    def test_longest_eye_closure_spans_the_run(self) -> None:
        interval = 0.5
        frames = _samples(
            (0.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
            (
                0.5,
                _frame(
                    state=DriverState.SLEEPING, level=AlertLevel.HIGH, fatigue=0.9, eyes_closed=True
                ),
            ),
            (
                1.0,
                _frame(
                    state=DriverState.SLEEPING, level=AlertLevel.HIGH, fatigue=0.9, eyes_closed=True
                ),
            ),
            (
                1.5,
                _frame(
                    state=DriverState.SLEEPING, level=AlertLevel.HIGH, fatigue=0.9, eyes_closed=True
                ),
            ),
            (2.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
        )
        result = aggregate_video(
            frames,
            duration_sec=2.5,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=5,
            sample_fps=1.0 / interval,
        )
        # Run spans t=0.5..1.5 (1.0s) plus one sample interval.
        assert result.longest_eye_closure_sec == 1.5

    def test_longest_eye_closure_run_open_at_end_of_clip(self) -> None:
        interval = 1.0
        frames = _samples(
            (0.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
            (
                1.0,
                _frame(
                    state=DriverState.SLEEPING, level=AlertLevel.HIGH, fatigue=0.9, eyes_closed=True
                ),
            ),
            (
                2.0,
                _frame(
                    state=DriverState.SLEEPING, level=AlertLevel.HIGH, fatigue=0.9, eyes_closed=True
                ),
            ),
        )
        result = aggregate_video(
            frames,
            duration_sec=3.0,
            width=640,
            height=480,
            source_fps=1.0,
            source_frame_count=3,
            sample_fps=1.0 / interval,
        )
        assert result.longest_eye_closure_sec == 2.0

    def test_total_alerts_counts_episodes_not_frames(self) -> None:
        frames = _samples(
            (0.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
            (
                0.5,
                _frame(state=DriverState.YAWNING, level=AlertLevel.LOW, fatigue=0.5, yawning=True),
            ),
            (
                1.0,
                _frame(state=DriverState.YAWNING, level=AlertLevel.LOW, fatigue=0.5, yawning=True),
            ),
            (1.5, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
            (
                2.0,
                _frame(
                    state=DriverState.SLEEPING, level=AlertLevel.HIGH, fatigue=0.9, eyes_closed=True
                ),
            ),
        )
        result = aggregate_video(
            frames,
            duration_sec=2.5,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=5,
            sample_fps=2.0,
        )
        assert result.total_alerts == 2

    def test_timeline_records_yawn_sleep_and_recovery(self) -> None:
        frames = _samples(
            (0.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
            (
                0.5,
                _frame(state=DriverState.YAWNING, level=AlertLevel.LOW, fatigue=0.5, yawning=True),
            ),
            (
                1.0,
                _frame(
                    state=DriverState.SLEEPING, level=AlertLevel.HIGH, fatigue=0.9, eyes_closed=True
                ),
            ),
            (1.5, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
        )
        result = aggregate_video(
            frames,
            duration_sec=2.0,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=4,
            sample_fps=2.0,
        )
        kinds = [(event.t, event.kind) for event in result.timeline]
        assert kinds == [(0.5, "yawn"), (1.0, "sleep"), (1.5, "recovered")]

    def test_distribution_only_includes_states_seen(self) -> None:
        frames = _samples(
            (0.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
            (0.5, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0)),
            (
                1.0,
                _frame(state=DriverState.YAWNING, level=AlertLevel.LOW, fatigue=0.5, yawning=True),
            ),
        )
        result = aggregate_video(
            frames,
            duration_sec=1.5,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=3,
            sample_fps=2.0,
        )
        distribution = {item.state: item.count for item in result.distribution}
        assert distribution == {DriverState.AWAKE: 2, DriverState.YAWNING: 1}

    def test_avg_ear_and_confidence_ignore_frames_with_no_evidence(self) -> None:
        frames = _samples(
            (0.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.0, ear=None)),
            (
                0.5,
                _frame(
                    state=DriverState.AWAKE,
                    level=AlertLevel.NONE,
                    fatigue=0.0,
                    ear=0.8,
                    detections=[_det(0.9)],
                ),
            ),
            (
                1.0,
                _frame(
                    state=DriverState.AWAKE,
                    level=AlertLevel.NONE,
                    fatigue=0.0,
                    ear=0.6,
                    detections=[_det(0.7)],
                ),
            ),
        )
        result = aggregate_video(
            frames,
            duration_sec=1.5,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=3,
            sample_fps=2.0,
        )
        assert result.avg_eye_aspect_ratio == 0.7
        assert result.avg_confidence == 0.8

    def test_mean_fatigue_and_max_fatigue(self) -> None:
        frames = _samples(
            (0.0, _frame(state=DriverState.AWAKE, level=AlertLevel.NONE, fatigue=0.1)),
            (
                0.5,
                _frame(
                    state=DriverState.SLEEPING, level=AlertLevel.HIGH, fatigue=0.9, eyes_closed=True
                ),
            ),
        )
        result = aggregate_video(
            frames,
            duration_sec=1.0,
            width=640,
            height=480,
            source_fps=2.0,
            source_frame_count=2,
            sample_fps=2.0,
        )
        assert result.fatigue_score == 0.5
        assert result.max_fatigue_score == 0.9
