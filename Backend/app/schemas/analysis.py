"""AI analysis request and response payloads (Phase G).

Wire contract for image inference. Every field the frontend's
``image-analysis.tsx`` reads is produced here and nowhere else, and each
payload nests inside the standard :class:`~app.schemas.common.ApiResponse`
envelope - it is never returned bare (03_Backend_Architecture.md §11).

Two contract decisions are honoured directly in these models:

* **Fatigue is served 0-100, not 0.0-1.0** (decision C5). The domain layer works
  on the persisted 0.0-1.0 scale; :meth:`ImageAnalysisData.from_domain` applies
  :data:`~app.core.constants.FATIGUE_API_SCALE` on the way out so every gauge in
  the frontend receives the range it expects.
* **EAR / MAR are derived, not measured** (decision C1). The detector emits
  bounding boxes and no facial landmarks, so these are geometric proxies. The
  ``derived`` flag makes that explicit to anything rendering the explainability
  panel; presenting an approximation as a measurement would be dishonest.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import (
    DRIVER_STATE_ALERT_LEVEL,
    FATIGUE_API_SCALE,
    AlertLevel,
    DriverState,
)

if TYPE_CHECKING:
    from app.domain.analysis import FrameAnalysis
    from app.domain.video_analysis import VideoAnalysis


class BoundingBox(BaseModel):
    """Axis-aligned detection box in pixel coordinates of the source image.

    Attributes:
        x1: Left edge.
        y1: Top edge.
        x2: Right edge.
        y2: Bottom edge.
    """

    x1: float = Field(description="Left edge, pixels.")
    y1: float = Field(description="Top edge, pixels.")
    x2: float = Field(description="Right edge, pixels.")
    y2: float = Field(description="Bottom edge, pixels.")


class Detection(BaseModel):
    """A single object the detector found in the frame.

    Attributes:
        label: Foreground class name, one of ``closed_eye``, ``open_eye``,
            ``yawn``. Background boxes are dropped before this point.
        label_index: The model's integer class index for ``label``, from
            :data:`~app.core.constants.MODEL_LABELS`. Carried so the frontend can
            colour boxes without re-deriving the mapping.
        score: Detector confidence in ``[0, 1]``.
        box: Location of the detection in the source image.
    """

    label: str = Field(description="Foreground class name.")
    label_index: int = Field(ge=1, description="Model class index (1..3).")
    score: float = Field(ge=0.0, le=1.0, description="Detector confidence.")
    box: BoundingBox = Field(description="Detection box, source-image pixels.")


class DerivedMetrics(BaseModel):
    """Geometric proxies derived from box geometry.

    Not measurements. The detector has no facial landmarks, so a true Eye Aspect
    Ratio cannot be computed (decision C1). These are approximations from box
    presence and size, and ``derived`` is always ``True`` to say so at the wire.

    Attributes:
        eye_aspect_ratio: Proxy for openness. Higher means more open-eye
            evidence. ``None`` when no eye box was found.
        mouth_aspect_ratio: Proxy for yawning. ``None`` when no yawn box was found.
        eyes_closed: Whether closed-eye evidence outweighs open-eye evidence.
        yawning: Whether a yawn was detected above threshold.
        derived: Always ``True``. These are proxies, not measured quantities.
    """

    eye_aspect_ratio: float | None = Field(
        default=None, description="Derived openness proxy; not a measured EAR."
    )
    mouth_aspect_ratio: float | None = Field(
        default=None, description="Derived yawn proxy; not a measured MAR."
    )
    eyes_closed: bool = Field(description="Closed-eye evidence outweighs open-eye.")
    yawning: bool = Field(description="A yawn was detected.")
    derived: bool = Field(default=True, description="Proxies, not measurements.")


class ImageAnalysisData(BaseModel):
    """Result of analysing a single image.

    Attributes:
        driver_state: Classified state, uppercase frontend spelling
            (``AWAKE`` / ``YAWNING`` / ``DROWSY`` / ``SLEEPING`` / ``UNKNOWN``).
        alert_level: Severity, frontend spelling
            (``SAFE`` / ``WARNING`` / ``DANGER`` / ``EMERGENCY``).
        fatigue_score: Fatigue on the 0-100 scale the frontend gauges expect.
        detections: Every foreground box the detector returned above threshold.
        metrics: Derived proxies for the explainability panel.
        inference_ms: Wall-clock time spent in the forward pass, milliseconds.
        image_width: Source image width, pixels.
        image_height: Source image height, pixels.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "driver_state": "DROWSY",
                "alert_level": "DANGER",
                "fatigue_score": 72,
                "detections": [
                    {
                        "label": "closed_eye",
                        "label_index": 1,
                        "score": 0.94,
                        "box": {"x1": 210.0, "y1": 140.0, "x2": 260.0, "y2": 175.0},
                    }
                ],
                "metrics": {
                    "eye_aspect_ratio": 0.11,
                    "mouth_aspect_ratio": None,
                    "eyes_closed": True,
                    "yawning": False,
                    "derived": True,
                },
                "inference_ms": 128.4,
                "image_width": 640,
                "image_height": 480,
            }
        }
    )

    driver_state: str = Field(description="Classified driver state, frontend spelling.")
    alert_level: str = Field(description="Alert severity, frontend spelling.")
    fatigue_score: int = Field(ge=0, le=100, description="Fatigue on the 0-100 scale.")
    detections: list[Detection] = Field(
        default_factory=list, description="Foreground detections above threshold."
    )
    metrics: DerivedMetrics = Field(description="Derived proxies for explainability.")
    inference_ms: float = Field(ge=0.0, description="Forward-pass time, milliseconds.")
    image_width: int = Field(gt=0, description="Source image width, pixels.")
    image_height: int = Field(gt=0, description="Source image height, pixels.")

    @classmethod
    def from_domain(cls, analysis: FrameAnalysis) -> ImageAnalysisData:
        """Build the wire payload from a domain :class:`FrameAnalysis`.

        This is the single boundary where the internal representation is
        translated to the contract: the 0.0-1.0 fatigue score is scaled to
        0-100 and the enums are rendered in their frontend spelling. Keeping the
        translation in one place stops the two vocabularies leaking into the
        domain layer.

        Args:
            analysis: The domain result produced by the analysis service.

        Returns:
            A populated :class:`ImageAnalysisData`.
        """
        state: DriverState = analysis.driver_state
        level: AlertLevel = analysis.alert_level
        return cls(
            driver_state=state.api_label,
            alert_level=level.api_label,
            fatigue_score=round(analysis.fatigue_score * FATIGUE_API_SCALE),
            detections=[
                Detection(
                    label=det.label,
                    label_index=det.label_index,
                    score=det.score,
                    box=BoundingBox(x1=det.x1, y1=det.y1, x2=det.x2, y2=det.y2),
                )
                for det in analysis.detections
            ],
            metrics=DerivedMetrics(
                eye_aspect_ratio=analysis.metrics.eye_aspect_ratio,
                mouth_aspect_ratio=analysis.metrics.mouth_aspect_ratio,
                eyes_closed=analysis.metrics.eyes_closed,
                yawning=analysis.metrics.yawning,
            ),
            inference_ms=analysis.inference_ms,
            image_width=analysis.image_width,
            image_height=analysis.image_height,
        )


class VideoFrameSample(BaseModel):
    """One sampled-and-analysed frame from an uploaded video.

    Attributes:
        t: Offset from the start of the video, seconds.
        driver_state: Classified state at this frame, frontend spelling.
        alert_level: Severity at this frame, frontend spelling.
        fatigue_score: Fatigue on the 0-100 scale.
        eye_aspect_ratio: Derived openness proxy; ``None`` with no eye evidence.
        mouth_aspect_ratio: Derived yawn proxy; ``None`` with no yawn evidence.
        confidence: Strongest detection score in this frame, or ``None``.
        detections: Every foreground box the detector returned in this frame.
    """

    t: float = Field(ge=0.0, description="Offset from video start, seconds.")
    driver_state: str = Field(description="Classified state, frontend spelling.")
    alert_level: str = Field(description="Alert severity, frontend spelling.")
    fatigue_score: int = Field(ge=0, le=100, description="Fatigue on the 0-100 scale.")
    eye_aspect_ratio: float | None = Field(default=None, description="Derived openness proxy.")
    mouth_aspect_ratio: float | None = Field(default=None, description="Derived yawn proxy.")
    confidence: float | None = Field(
        default=None, description="Strongest detection score in this frame."
    )
    detections: list[Detection] = Field(
        default_factory=list, description="Foreground detections in this frame."
    )


class VideoTimelineEvent(BaseModel):
    """A notable state transition within the video.

    Attributes:
        t: Offset from the start of the video, seconds.
        kind: Short category the frontend timeline colours by (``"yawn"``,
            ``"sleep"``, ``"recovered"``).
        label: Human-readable description.
    """

    t: float = Field(ge=0.0, description="Offset from video start, seconds.")
    kind: str = Field(description="Event category for the timeline UI.")
    label: str = Field(description="Human-readable description.")


class VideoStateCount(BaseModel):
    """Number of sampled frames classified into one driver state.

    Attributes:
        state: Driver state, frontend spelling.
        count: Number of sampled frames in this state.
    """

    state: str = Field(description="Driver state, frontend spelling.")
    count: int = Field(ge=0, description="Sampled frames classified into this state.")


class VideoAnalysisSummary(BaseModel):
    """Whole-clip summary of a video analysis.

    Attributes:
        driver_state: Most severe state observed anywhere in the clip.
        alert_level: Severity matching ``driver_state``.
        fatigue_score: Mean fatigue across sampled frames, 0-100 scale.
        max_fatigue_score: Peak fatigue across sampled frames, 0-100 scale.
        total_yawns: Number of separate yawn onsets.
        longest_eye_closure_sec: Longest unbroken closed-eye run, seconds.
        avg_eye_aspect_ratio: Mean openness proxy over frames with eye evidence.
        avg_mouth_aspect_ratio: Mean yawn proxy over frames with yawn evidence.
        avg_confidence: Mean of each frame's strongest detection score.
        total_alerts: Number of separate alert episodes.
        session_duration_sec: Source video duration, seconds.
    """

    driver_state: str = Field(description="Most severe state observed in the clip.")
    alert_level: str = Field(description="Severity matching driver_state.")
    fatigue_score: int = Field(ge=0, le=100, description="Mean fatigue, 0-100 scale.")
    max_fatigue_score: int = Field(ge=0, le=100, description="Peak fatigue, 0-100 scale.")
    total_yawns: int = Field(ge=0, description="Number of separate yawn onsets.")
    longest_eye_closure_sec: float = Field(
        ge=0.0, description="Longest unbroken closed-eye run, seconds."
    )
    avg_eye_aspect_ratio: float | None = Field(default=None, description="Mean openness proxy.")
    avg_mouth_aspect_ratio: float | None = Field(default=None, description="Mean yawn proxy.")
    avg_confidence: float | None = Field(
        default=None, description="Mean strongest detection score."
    )
    total_alerts: int = Field(ge=0, description="Number of separate alert episodes.")
    session_duration_sec: float = Field(ge=0.0, description="Source video duration, seconds.")


class VideoAnalysisData(BaseModel):
    """Result of analysing an uploaded video.

    The model cannot run at the source frame rate within one HTTP request
    (Phase G2), so the clip is sampled. Every field here describes what was
    actually sampled and analysed - never the caller's originally requested
    rate - so the frontend never presents an unapplied setting as fact.

    Attributes:
        video_duration_sec: Source video duration, seconds.
        video_width: Source video frame width, pixels.
        video_height: Source video frame height, pixels.
        source_fps: Source video's own frame rate.
        source_frame_count: Total frames in the source video.
        sample_fps: Sampling rate actually applied.
        sampled_frame_count: Number of frames actually analysed.
        summary: Whole-clip aggregate statistics.
        frames: Every sampled frame, in order.
        timeline: Notable state transitions, in order.
        distribution: Sampled-frame count per driver state.
        preview_video_url: Path to a burned-in annotated MP4 of the whole
            clip (relative to this router, e.g. fetch it at
            ``{API base}/analysis/video/preview/{token}``), or ``None`` when
            one was not generated - a long clip past
            :data:`~app.core.constants.MAX_ANNOTATED_VIDEO_FRAMES`, or the
            encoder failing. Never a broken link: this is only ever set once
            the file exists and is registered.
    """

    video_duration_sec: float = Field(ge=0.0, description="Source video duration, seconds.")
    video_width: int = Field(gt=0, description="Source video frame width, pixels.")
    video_height: int = Field(gt=0, description="Source video frame height, pixels.")
    source_fps: float = Field(ge=0.0, description="Source video's own frame rate.")
    source_frame_count: int = Field(ge=0, description="Total frames in the source video.")
    sample_fps: float = Field(gt=0.0, description="Sampling rate actually applied.")
    sampled_frame_count: int = Field(ge=0, description="Number of frames actually analysed.")
    summary: VideoAnalysisSummary = Field(description="Whole-clip aggregate statistics.")
    frames: list[VideoFrameSample] = Field(
        default_factory=list, description="Every sampled frame, in order."
    )
    timeline: list[VideoTimelineEvent] = Field(
        default_factory=list, description="Notable state transitions, in order."
    )
    distribution: list[VideoStateCount] = Field(
        default_factory=list, description="Sampled-frame count per driver state."
    )
    preview_video_url: str | None = Field(
        default=None, description="Path to the burned-in annotated video, if one was generated."
    )

    @classmethod
    def from_domain(cls, analysis: VideoAnalysis) -> VideoAnalysisData:
        """Build the wire payload from a domain :class:`VideoAnalysis`.

        Args:
            analysis: The domain result produced by the video analysis service.

        Returns:
            A populated :class:`VideoAnalysisData`.
        """
        state: DriverState = analysis.driver_state
        level: AlertLevel = DRIVER_STATE_ALERT_LEVEL[state]
        return cls(
            video_duration_sec=analysis.duration_sec,
            video_width=analysis.width,
            video_height=analysis.height,
            source_fps=analysis.source_fps,
            source_frame_count=analysis.source_frame_count,
            sample_fps=analysis.sample_fps,
            sampled_frame_count=analysis.sampled_frame_count,
            summary=VideoAnalysisSummary(
                driver_state=state.api_label,
                alert_level=level.api_label,
                fatigue_score=round(analysis.fatigue_score * FATIGUE_API_SCALE),
                max_fatigue_score=round(analysis.max_fatigue_score * FATIGUE_API_SCALE),
                total_yawns=analysis.total_yawns,
                longest_eye_closure_sec=analysis.longest_eye_closure_sec,
                avg_eye_aspect_ratio=analysis.avg_eye_aspect_ratio,
                avg_mouth_aspect_ratio=analysis.avg_mouth_aspect_ratio,
                avg_confidence=analysis.avg_confidence,
                total_alerts=analysis.total_alerts,
                session_duration_sec=analysis.duration_sec,
            ),
            frames=[
                VideoFrameSample(
                    t=sample.t,
                    driver_state=sample.analysis.driver_state.api_label,
                    alert_level=sample.analysis.alert_level.api_label,
                    fatigue_score=round(sample.analysis.fatigue_score * FATIGUE_API_SCALE),
                    eye_aspect_ratio=(
                        sample.analysis.metrics.eye_aspect_ratio
                        if sample.analysis.metrics
                        else None
                    ),
                    mouth_aspect_ratio=(
                        sample.analysis.metrics.mouth_aspect_ratio
                        if sample.analysis.metrics
                        else None
                    ),
                    confidence=max((det.score for det in sample.analysis.detections), default=None),
                    detections=[
                        Detection(
                            label=det.label,
                            label_index=det.label_index,
                            score=det.score,
                            box=BoundingBox(x1=det.x1, y1=det.y1, x2=det.x2, y2=det.y2),
                        )
                        for det in sample.analysis.detections
                    ],
                )
                for sample in analysis.frames
            ],
            timeline=[
                VideoTimelineEvent(t=event.t, kind=event.kind, label=event.label)
                for event in analysis.timeline
            ],
            distribution=[
                VideoStateCount(state=item.state.api_label, count=item.count)
                for item in analysis.distribution
            ],
            preview_video_url=(
                f"/analysis/video/preview/{analysis.preview_token}"
                if analysis.preview_token
                else None
            ),
        )
