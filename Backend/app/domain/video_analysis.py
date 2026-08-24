"""Multi-frame drowsiness aggregation for an uploaded video (Phase G2).

Pure computation: given a time-ordered sequence of already-classified frames
(each produced by :func:`app.domain.analysis.analyze_frame`), summarise the
clip - overall driver state, fatigue statistics, alert episodes, longest eye
closure, a state-transition timeline and a per-state distribution.

This is deliberately simpler than the temporal fatigue engine described for
Phase H (no PERCLOS window, no decay). It has no I/O and no request objects,
which is what makes it directly unit-testable against synthetic frame
sequences.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.core.constants import AlertLevel, DriverState
from app.domain.analysis import FrameAnalysis

# Ordinal severity for "worst state seen" and "recovered" comparisons.
# DriverState has no natural ordering (StrEnum members compare by value), and
# a single frame's classifier never emits DROWSY (that state is reserved for
# Phase H's temporal engine) - it is ranked here only so the table stays
# complete if that changes.
_STATE_SEVERITY: dict[DriverState, int] = {
    DriverState.UNKNOWN: 0,
    DriverState.AWAKE: 0,
    DriverState.YAWNING: 1,
    DriverState.DROWSY: 2,
    DriverState.SLEEPING: 3,
}


@dataclass(frozen=True, slots=True)
class FrameSample:
    """One analysed frame, timestamped against the source video.

    Attributes:
        t: Offset from the start of the video, in seconds.
        analysis: The per-frame classification result.
    """

    t: float
    analysis: FrameAnalysis


@dataclass(frozen=True, slots=True)
class TimelineEvent:
    """A single notable state transition, for the event timeline.

    Attributes:
        t: Offset from the start of the video, in seconds.
        kind: Short category matching the frontend's ``Timeline`` component
            (``"yawn"``, ``"sleep"``, ``"recovered"``).
        label: Human-readable description.
    """

    t: float
    kind: str
    label: str


@dataclass(frozen=True, slots=True)
class StateCount:
    """Number of sampled frames classified into one driver state."""

    state: DriverState
    count: int


@dataclass(frozen=True, slots=True)
class VideoAnalysis:
    """Everything the service produced for one uploaded video.

    Fatigue figures are on the same persisted 0.0-1.0 scale as
    :class:`~app.domain.analysis.FrameAnalysis` (decision C5); the wire layer
    scales them to 0-100.

    Attributes:
        duration_sec: Source video duration, seconds.
        width: Source video frame width, pixels.
        height: Source video frame height, pixels.
        source_fps: Source video's own frame rate.
        source_frame_count: Total frames in the source video.
        sample_fps: Sampling rate actually used (never the caller's raw
            request - always what the server applied).
        sampled_frame_count: Number of frames actually run through the model.
        driver_state: The most severe state observed anywhere in the clip.
        fatigue_score: Mean fatigue across all sampled frames.
        max_fatigue_score: Peak fatigue across all sampled frames.
        total_yawns: Number of times yawning evidence began (rising edges,
            not raw frame count, so one sustained yawn is not double counted).
        longest_eye_closure_sec: Longest unbroken run of closed-eye evidence.
        avg_eye_aspect_ratio: Mean of the per-frame openness proxy, over
            frames where eye evidence existed at all.
        avg_mouth_aspect_ratio: Mean of the per-frame yawn proxy, over frames
            where a yawn was detected.
        avg_confidence: Mean of each frame's strongest detection score, over
            frames with at least one detection.
        total_alerts: Number of alert episodes (consecutive runs of a
            non-``NONE`` alert level, counted once per run).
        frames: Every sampled frame, in order.
        timeline: Notable state transitions, in order.
        distribution: Sampled-frame count per driver state.
        preview_token: Lookup token for a burned-in annotated video preview
            (see :mod:`app.services.preview_store`), or ``None`` when one was
            not generated (clip too long, or encoding failed). Not set by
            :func:`aggregate_video` - attached afterwards by
            :class:`~app.services.video_analysis_service.VideoAnalysisService`,
            since it is an encoding artifact, not a metric derived from the
            frame sequence.
    """

    duration_sec: float
    width: int
    height: int
    source_fps: float
    source_frame_count: int
    sample_fps: float
    sampled_frame_count: int
    driver_state: DriverState
    fatigue_score: float
    max_fatigue_score: float
    total_yawns: int
    longest_eye_closure_sec: float
    avg_eye_aspect_ratio: float | None
    avg_mouth_aspect_ratio: float | None
    avg_confidence: float | None
    total_alerts: int
    frames: list[FrameSample] = field(default_factory=list)
    timeline: list[TimelineEvent] = field(default_factory=list)
    distribution: list[StateCount] = field(default_factory=list)
    preview_token: str | None = None


def _mean(values: list[float]) -> float | None:
    """Arithmetic mean, or ``None`` for an empty sample.

    Args:
        values: Numbers to average.

    Returns:
        The mean, or ``None`` when ``values`` is empty.
    """
    return round(sum(values) / len(values), 4) if values else None


def _frame_confidence(sample: FrameSample) -> float | None:
    """Strongest detection score in one frame, or ``None`` with no detections.

    Args:
        sample: The frame to inspect.

    Returns:
        The maximum detection score, or ``None``.
    """
    scores = [det.score for det in sample.analysis.detections]
    return max(scores, default=None)


def _worst_state(frames: list[FrameSample]) -> DriverState:
    """The most severe driver state observed anywhere in the clip.

    ``UNKNOWN`` (no evidence at all) only wins when every frame is unknown -
    it must never mask a real detection elsewhere in the clip.

    Args:
        frames: All sampled frames.

    Returns:
        The worst :class:`DriverState` seen, or ``UNKNOWN`` with no frames.
    """
    if not frames:
        return DriverState.UNKNOWN
    ranked = [f for f in frames if f.analysis.driver_state is not DriverState.UNKNOWN]
    candidates = ranked or frames
    return max(
        (f.analysis.driver_state for f in candidates),
        key=lambda state: _STATE_SEVERITY[state],
    )


def count_yawn_onsets(frames: list[FrameSample]) -> int:
    """Count rising edges of yawn evidence across a frame sequence.

    Public (not clip-specific) because :mod:`app.services.session_recording_service`
    reuses it for a live webcam session's events, which are exactly this same
    ``FrameSample`` shape.

    Args:
        frames: All sampled frames, in time order.

    Returns:
        The number of times yawning evidence began.
    """
    onsets = 0
    was_yawning = False
    for sample in frames:
        yawning = sample.analysis.metrics.yawning if sample.analysis.metrics else False
        if yawning and not was_yawning:
            onsets += 1
        was_yawning = yawning
    return onsets


def _longest_eye_closure_sec(frames: list[FrameSample], *, sample_interval_sec: float) -> float:
    """Longest unbroken run of closed-eye evidence, in seconds.

    Args:
        frames: All sampled frames, in time order.
        sample_interval_sec: Seconds between consecutive samples, used to
            extend a run's span by one interval so a single-sample run is not
            reported as zero-length.

    Returns:
        The longest run's duration in seconds, or ``0.0`` if eyes were never
        closed.
    """
    longest = 0.0
    run_start: float | None = None
    run_end: float | None = None
    for sample in frames:
        closed = sample.analysis.metrics.eyes_closed if sample.analysis.metrics else False
        if closed:
            if run_start is None:
                run_start = sample.t
            run_end = sample.t
        else:
            if run_start is not None and run_end is not None:
                longest = max(longest, run_end - run_start + sample_interval_sec)
            run_start = None
            run_end = None
    if run_start is not None and run_end is not None:
        longest = max(longest, run_end - run_start + sample_interval_sec)
    return round(longest, 2)


def count_alert_episodes(frames: list[FrameSample]) -> int:
    """Count alert episodes: consecutive runs of a non-``NONE`` alert level.

    Public for the same reason as :func:`count_yawn_onsets` - reused by
    :mod:`app.services.session_recording_service` for a live session's events.

    Args:
        frames: All sampled frames, in time order.

    Returns:
        The number of separate episodes during which the driver was alerted.
    """
    episodes = 0
    in_episode = False
    for sample in frames:
        active = sample.analysis.alert_level is not AlertLevel.NONE
        if active and not in_episode:
            episodes += 1
        in_episode = active
    return episodes


def cumulative_eye_closure_seconds(frames: list[FrameSample]) -> float:
    """Total time spent with eyes closed, approximated from sample spacing.

    There is no continuous eye-closure signal, only periodic samples - the
    interval *before* each closed-eye sample is counted as closed time. This
    is a genuinely different metric from :func:`aggregate_video`'s
    longest-single-run calculation (``longest_eye_closure_sec``): one is a
    cumulative total, the other a single longest run. Public because both
    :mod:`app.services.session_recording_service` (webcam sessions) and
    :mod:`app.services.upload_service` (uploaded video sessions) need the
    cumulative figure for ``detection_sessions.eye_closure_seconds``, which
    ``aggregate_video`` itself does not compute.

    Args:
        frames: All sampled frames, in time order.

    Returns:
        Cumulative closed-eye time, seconds.
    """
    if len(frames) < 2:
        return 0.0
    total = 0.0
    for previous, current in zip(frames, frames[1:], strict=False):
        if current.analysis.metrics and current.analysis.metrics.eyes_closed:
            total += current.t - previous.t
    return round(total, 2)


def _build_timeline(frames: list[FrameSample]) -> list[TimelineEvent]:
    """Derive the event timeline from real state transitions.

    Only three kinds are produced, matching what the classifier can actually
    tell apart: a rise into ``YAWNING``, a rise into ``SLEEPING`` (the
    classifier's closed-eye state), and a recovery back to ``AWAKE`` from a
    worse state. No synthetic "drowsy" or "eye-closed" events are invented for
    states the single-frame classifier does not produce.

    Args:
        frames: All sampled frames, in time order.

    Returns:
        Timeline events in chronological order.
    """
    events: list[TimelineEvent] = []
    previous: DriverState = DriverState.UNKNOWN
    for sample in frames:
        state = sample.analysis.driver_state
        if state != previous:
            if state is DriverState.YAWNING and previous is not DriverState.YAWNING:
                events.append(TimelineEvent(t=sample.t, kind="yawn", label="Yawning detected"))
            elif state is DriverState.SLEEPING:
                events.append(
                    TimelineEvent(t=sample.t, kind="sleep", label="Sleep warning triggered")
                )
            elif (
                state is DriverState.AWAKE
                and _STATE_SEVERITY[previous] > _STATE_SEVERITY[DriverState.AWAKE]
            ):
                events.append(TimelineEvent(t=sample.t, kind="recovered", label="Driver recovered"))
        previous = state
    return events


def _build_distribution(frames: list[FrameSample]) -> list[StateCount]:
    """Count sampled frames per driver state, in a stable display order.

    Args:
        frames: All sampled frames.

    Returns:
        One :class:`StateCount` per state that actually occurred, ordered
        awake to sleeping.
    """
    order = [
        DriverState.AWAKE,
        DriverState.YAWNING,
        DriverState.DROWSY,
        DriverState.SLEEPING,
        DriverState.UNKNOWN,
    ]
    counts = dict.fromkeys(order, 0)
    for sample in frames:
        counts[sample.analysis.driver_state] += 1
    return [StateCount(state=state, count=count) for state, count in counts.items() if count > 0]


def aggregate_video(
    frames: list[FrameSample],
    *,
    duration_sec: float,
    width: int,
    height: int,
    source_fps: float,
    source_frame_count: int,
    sample_fps: float,
) -> VideoAnalysis:
    """Aggregate a sequence of analysed frames into a whole-clip summary.

    Args:
        frames: Analysed frames in time order, already classified by
            :func:`~app.domain.analysis.analyze_frame`.
        duration_sec: Source video duration, seconds.
        width: Source video frame width, pixels.
        height: Source video frame height, pixels.
        source_fps: Source video's own frame rate.
        source_frame_count: Total frames in the source video.
        sample_fps: Sampling rate actually applied.

    Returns:
        A populated :class:`VideoAnalysis`.
    """
    sample_interval_sec = 1.0 / sample_fps if sample_fps > 0 else 0.0
    fatigue_scores = [f.analysis.fatigue_score for f in frames]
    ear_values = [
        f.analysis.metrics.eye_aspect_ratio
        for f in frames
        if f.analysis.metrics and f.analysis.metrics.eye_aspect_ratio is not None
    ]
    mar_values = [
        f.analysis.metrics.mouth_aspect_ratio
        for f in frames
        if f.analysis.metrics and f.analysis.metrics.mouth_aspect_ratio is not None
    ]
    confidence_values = [c for c in (_frame_confidence(f) for f in frames) if c is not None]

    return VideoAnalysis(
        duration_sec=duration_sec,
        width=width,
        height=height,
        source_fps=source_fps,
        source_frame_count=source_frame_count,
        sample_fps=sample_fps,
        sampled_frame_count=len(frames),
        driver_state=_worst_state(frames),
        fatigue_score=round(_mean(fatigue_scores) or 0.0, 4),
        max_fatigue_score=max(fatigue_scores, default=0.0),
        total_yawns=count_yawn_onsets(frames),
        longest_eye_closure_sec=_longest_eye_closure_sec(
            frames, sample_interval_sec=sample_interval_sec
        ),
        avg_eye_aspect_ratio=_mean(ear_values),
        avg_mouth_aspect_ratio=_mean(mar_values),
        avg_confidence=_mean(confidence_values),
        total_alerts=count_alert_episodes(frames),
        frames=frames,
        timeline=_build_timeline(frames),
        distribution=_build_distribution(frames),
    )
