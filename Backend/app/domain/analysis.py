"""Single-frame drowsiness analysis.

Pure computation: given the detections from one image, decide the driver state,
the alert level and a fatigue score. No I/O, no request objects - which is what
makes this directly unit-testable against synthetic detections (Testing
Strategy §5).

Correctness note - label mapping
--------------------------------
This module takes its class indices from :mod:`app.core.constants`
(``1 = closed_eye, 2 = open_eye, 3 = yawn``), which matches the trained weights.
It deliberately does **not** reuse the convention in the repository-root
``utils/driver_state.py``, which has open and closed inverted and therefore
reports drowsiness when the eyes are open (see ``app/domain/__init__.py``).

This is a per-frame classifier. Temporal smoothing across a stream (the state
machine and PERCLOS-style scoring) is Phase H; a single image has no history, so
the score here is a direct function of the current frame's evidence.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.core.constants import (
    DRIVER_STATE_ALERT_LEVEL,
    MODEL_LABEL_CLOSED_EYE,
    MODEL_LABEL_OPEN_EYE,
    MODEL_LABEL_YAWN,
    MODEL_LABELS,
    AlertLevel,
    DriverState,
)
from app.domain.models.base import RawDetection

# Fatigue contributions for a single frame, on the persisted 0.0-1.0 scale
# (decision C5 - the API layer scales to 0-100). These are deliberately simple
# and explicit: a single image cannot express PERCLOS or a yawn *rate*, so the
# frame score is evidence-driven rather than time-integrated. Phase H replaces
# this with the temporal engine.
_FATIGUE_EYES_CLOSED = 0.7
_FATIGUE_YAWN = 0.5
_FATIGUE_BASELINE = 0.05


@dataclass(frozen=True, slots=True)
class AnalyzedDetection:
    """A detection with its class name resolved, ready for the wire layer.

    Attributes:
        label: Foreground class name from :data:`~app.core.constants.MODEL_LABELS`.
        label_index: The model class index (``1..3``).
        score: Detector confidence.
        x1, y1, x2, y2: Box corners in source-image pixels.
    """

    label: str
    label_index: int
    score: float
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass(frozen=True, slots=True)
class DerivedMetrics:
    """Geometric proxies derived from the frame's boxes (decision C1).

    Not measured quantities. Without facial landmarks a true EAR/MAR cannot be
    computed, so these are approximations and are always flagged ``derived``.
    """

    eye_aspect_ratio: float | None
    mouth_aspect_ratio: float | None
    eyes_closed: bool
    yawning: bool
    derived: bool = True


@dataclass(frozen=True, slots=True)
class FrameAnalysis:
    """Everything the service produced for one image.

    Attributes:
        driver_state: Classified state.
        alert_level: Severity derived from the state.
        fatigue_score: Fatigue on the 0.0-1.0 persisted scale.
        detections: Foreground detections with names resolved.
        metrics: Derived proxies for the explainability panel.
        inference_ms: Forward-pass time, milliseconds.
        image_width: Source width, pixels.
        image_height: Source height, pixels.
    """

    driver_state: DriverState
    alert_level: AlertLevel
    fatigue_score: float
    detections: list[AnalyzedDetection] = field(default_factory=list)
    metrics: DerivedMetrics | None = None
    inference_ms: float = 0.0
    image_width: int = 0
    image_height: int = 0


def _best_score(detections: list[RawDetection], label_index: int) -> float:
    """Highest confidence among detections of one class, or 0.0 if none.

    Args:
        detections: All raw detections for the frame.
        label_index: The class index to filter on.

    Returns:
        The maximum score for that class, or ``0.0`` when it is absent.
    """
    scores = [det.score for det in detections if det.label_index == label_index]
    return max(scores, default=0.0)


def _eye_openness_proxy(detections: list[RawDetection]) -> float | None:
    """Derive an openness proxy in ``[0, 1]`` from open/closed eye evidence.

    Uses the confidence margin between open-eye and closed-eye detections. This
    is a proxy, not an Eye Aspect Ratio: the detector has no landmarks. Returns
    ``None`` when neither eye class was detected at all.

    Args:
        detections: All raw detections for the frame.

    Returns:
        A number in ``[0, 1]`` where higher means more open-eye evidence, or
        ``None`` when there is no eye evidence either way.
    """
    open_score = _best_score(detections, MODEL_LABEL_OPEN_EYE)
    closed_score = _best_score(detections, MODEL_LABEL_CLOSED_EYE)
    if open_score == 0.0 and closed_score == 0.0:
        return None
    total = open_score + closed_score
    return round(open_score / total, 4) if total > 0 else None


def _yawn_proxy(detections: list[RawDetection]) -> float | None:
    """Derive a yawn proxy from the strongest yawn detection.

    Args:
        detections: All raw detections for the frame.

    Returns:
        The best yawn confidence, or ``None`` when no yawn was detected.
    """
    score = _best_score(detections, MODEL_LABEL_YAWN)
    return round(score, 4) if score > 0.0 else None


def _classify(*, eyes_closed: bool, yawning: bool, has_evidence: bool) -> DriverState:
    """Map frame evidence to a driver state.

    Precedence follows severity: eyes closed (sleeping) outranks a yawn
    (yawning). With no face evidence at all the state is ``UNKNOWN`` rather than
    a falsely reassuring ``AWAKE`` - the frontend renders that distinctly.

    Args:
        eyes_closed: Closed-eye evidence outweighs open-eye evidence.
        yawning: A yawn was detected above threshold.
        has_evidence: Any eye or yawn detection was present.

    Returns:
        The classified :class:`DriverState`.
    """
    if not has_evidence:
        return DriverState.UNKNOWN
    if eyes_closed:
        return DriverState.SLEEPING
    if yawning:
        return DriverState.YAWNING
    return DriverState.AWAKE


def _fatigue_score(*, eyes_closed: bool, yawning: bool, has_evidence: bool) -> float:
    """Compute a single-frame fatigue score on the 0.0-1.0 scale.

    Deliberately simple and monotone in the evidence: closed eyes contribute
    most, a yawn less, and an alert frame carries a small nonzero baseline so the
    gauge is never a flat zero. Bounded to ``[0, 1]``. Phase H's temporal engine
    replaces this with PERCLOS-style integration over a window.

    Args:
        eyes_closed: Closed-eye evidence dominates.
        yawning: A yawn was detected.
        has_evidence: Any detection was present.

    Returns:
        Fatigue in ``[0.0, 1.0]``.
    """
    if not has_evidence:
        return 0.0
    score = _FATIGUE_BASELINE
    if eyes_closed:
        score += _FATIGUE_EYES_CLOSED
    if yawning:
        score += _FATIGUE_YAWN
    return round(min(1.0, score), 4)


def analyze_frame(
    detections: list[RawDetection],
    *,
    image_width: int,
    image_height: int,
    inference_ms: float = 0.0,
) -> FrameAnalysis:
    """Classify one frame from its detections.

    Args:
        detections: Raw foreground detections from the backend.
        image_width: Source image width, pixels.
        image_height: Source image height, pixels.
        inference_ms: Forward-pass time to carry through to the payload.

    Returns:
        A :class:`FrameAnalysis` with state, level, score, named detections and
        derived metrics.
    """
    open_proxy = _eye_openness_proxy(detections)
    yawn_proxy = _yawn_proxy(detections)

    closed_score = _best_score(detections, MODEL_LABEL_CLOSED_EYE)
    open_score = _best_score(detections, MODEL_LABEL_OPEN_EYE)
    eyes_closed = closed_score > open_score
    yawning = yawn_proxy is not None
    has_evidence = bool(detections)

    state = _classify(eyes_closed=eyes_closed, yawning=yawning, has_evidence=has_evidence)
    level = DRIVER_STATE_ALERT_LEVEL[state]
    score = _fatigue_score(eyes_closed=eyes_closed, yawning=yawning, has_evidence=has_evidence)

    metrics = DerivedMetrics(
        eye_aspect_ratio=open_proxy,
        mouth_aspect_ratio=yawn_proxy,
        eyes_closed=eyes_closed,
        yawning=yawning,
    )

    named = [
        AnalyzedDetection(
            label=MODEL_LABELS[det.label_index],
            label_index=det.label_index,
            score=det.score,
            x1=det.x1,
            y1=det.y1,
            x2=det.x2,
            y2=det.y2,
        )
        for det in detections
    ]

    return FrameAnalysis(
        driver_state=state,
        alert_level=level,
        fatigue_score=score,
        detections=named,
        metrics=metrics,
        inference_ms=inference_ms,
        image_width=image_width,
        image_height=image_height,
    )
