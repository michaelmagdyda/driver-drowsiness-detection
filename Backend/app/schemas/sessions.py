"""Session and detection-event schemas (Phase F/H history).

Wire contract for ``public.detection_sessions`` and ``public.detection_events``.
Every model here mirrors a real, already-applied table (Frontend/supabase/
migrations) - nothing is fabricated. ``fatigue_score`` follows the same
0.0-1.0-persisted, 0-100-served convention as the image-analysis contract
(decision C5, :data:`~app.core.constants.FATIGUE_API_SCALE`), and
``final_state``/``state``/``alert_level`` are rendered in the frontend's
uppercase spelling via the existing :class:`DriverState`/:class:`AlertLevel`
``api_label`` properties, exactly as ``ImageAnalysisData`` does.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.constants import (
    API_LABEL_TO_ALERT_LEVEL,
    DRIVER_STATE_ALERT_LEVEL,
    FATIGUE_API_SCALE,
    AlertLevel,
    DriverState,
)
from app.schemas.analysis import Detection


def _scaled_fatigue(value: Any) -> int | None:
    """Convert a persisted 0.0-1.0 fatigue score to the served 0-100 scale.

    Args:
        value: Raw column value, ``None`` when no score has been recorded yet.

    Returns:
        The rounded 0-100 score, or ``None``.
    """
    return None if value is None else round(float(value) * FATIGUE_API_SCALE)


class SessionSummary(BaseModel):
    """One row of ``public.detection_sessions``, as listed in History.

    Attributes:
        id: Session id.
        source: Monitoring source (``webcam``, ``dashcam``, ``video``, ``image``).
        status: Lifecycle status (``active``, ``processing``, ``completed``,
            ``failed``) - not a safety judgement, just where the session is in
            its own lifecycle.
        started_at: When monitoring began.
        ended_at: When monitoring ended, ``None`` while still active.
        duration_seconds: Session length, ``None`` until ended.
        total_events: Count of detection events recorded.
        total_alerts: Count of alerts raised during the session.
        yawn_count: Number of distinct yawns detected.
        eye_closure_seconds: Cumulative eyes-closed time.
        max_fatigue_score: Highest fatigue score observed, 0-100. ``None`` if
            the session has no events yet.
        final_state: Classified state at the end of the session, frontend
            spelling (e.g. ``"DROWSY"``). ``None`` while still active.
        alert_level: Severity implied by ``final_state``, frontend spelling
            (see :data:`~app.core.constants.DRIVER_STATE_ALERT_LEVEL`).
            ``None`` when ``final_state`` is unknown.
        created_at: Row creation time.
    """

    id: UUID
    source: str = Field(description="Monitoring source: webcam, dashcam, video or image.")
    status: str = Field(description="Lifecycle status: active, processing, completed or failed.")
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: float | None = None
    total_events: int = 0
    total_alerts: int = 0
    yawn_count: int = 0
    eye_closure_seconds: float = 0.0
    max_fatigue_score: int | None = None
    final_state: str | None = None
    alert_level: str | None = None
    created_at: datetime

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> SessionSummary:
        """Build a summary from a raw ``detection_sessions`` row.

        Args:
            row: The dict returned by the Supabase client.

        Returns:
            A populated :class:`SessionSummary`.
        """
        final_state = DriverState(row["final_state"]) if row.get("final_state") else None
        return cls(
            id=row["id"],
            source=row["source"],
            status=row["status"],
            started_at=row["started_at"],
            ended_at=row.get("ended_at"),
            duration_seconds=row.get("duration_seconds"),
            total_events=row.get("total_events", 0),
            total_alerts=row.get("total_alerts", 0),
            yawn_count=row.get("yawn_count", 0),
            eye_closure_seconds=row.get("eye_closure_seconds", 0.0),
            max_fatigue_score=_scaled_fatigue(row.get("max_fatigue_score")),
            final_state=final_state.api_label if final_state else None,
            alert_level=DRIVER_STATE_ALERT_LEVEL[final_state].api_label if final_state else None,
            created_at=row["created_at"],
        )


class MediaInfo(BaseModel):
    """Where a session's recording lives in Supabase Storage.

    The frontend uses this to generate its own signed playback URL
    (``supabase.storage.from(bucket).createSignedUrl(storagePath, ...)``) -
    the backend never proxies the video bytes for this path, since the
    ``session-clips`` bucket's own RLS already grants an authenticated user
    read access to their own clips.

    Attributes:
        bucket: Storage bucket name.
        storage_path: Object path within the bucket.
        mime_type: Content type of the stored file.
    """

    bucket: str
    storage_path: str
    mime_type: str

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> MediaInfo:
        """Build from a raw ``uploaded_media`` row.

        Args:
            row: The dict returned by the Supabase client.

        Returns:
            A populated :class:`MediaInfo`.
        """
        return cls(
            bucket=row["bucket"], storage_path=row["storage_path"], mime_type=row["mime_type"]
        )


class SessionDetail(SessionSummary):
    """A single session, with the fields the list view omits.

    Attributes:
        media_id: The uploaded media this session analysed, ``None`` for a
            live (webcam) session with no stored file.
        media: Where that file lives, if ``media_id`` is set. ``None`` both
            when there is no media and when it could not be resolved.
        updated_at: Last modification time.
    """

    media_id: UUID | None = None
    media: MediaInfo | None = None
    updated_at: datetime

    @classmethod
    def from_row(
        cls, row: dict[str, Any], media_row: dict[str, Any] | None = None
    ) -> SessionDetail:
        """Build a detail record from a raw ``detection_sessions`` row.

        Args:
            row: The dict returned by the Supabase client.
            media_row: The linked ``uploaded_media`` row, if ``row["media_id"]``
                is set and the lookup succeeded. ``None`` otherwise.

        Returns:
            A populated :class:`SessionDetail`.
        """
        summary = SessionSummary.from_row(row)
        return cls(
            **summary.model_dump(),
            media_id=row.get("media_id"),
            media=MediaInfo.from_row(media_row) if media_row else None,
            updated_at=row["updated_at"],
        )


class DetectionEvent(BaseModel):
    """One row of ``public.detection_events`` - a single classified frame.

    Attributes:
        id: Event id.
        ts: Timestamp of the frame.
        ear: Derived eye-aspect-ratio proxy, ``None`` when not computable.
        mar: Derived mouth-aspect-ratio proxy, ``None`` when not computable.
        head_pitch: Derived head pitch, degrees. ``None`` when not computed.
        head_yaw: Derived head yaw, degrees. ``None`` when not computed.
        head_roll: Derived head roll, degrees. ``None`` when not computed.
        eye_closed: Whether the eyes were classified closed this frame.
        yawning: Whether a yawn was classified this frame.
        state: Classified state, frontend spelling.
        fatigue_score: Fatigue at this frame, 0-100. ``None`` if not scored.
        alert_level: Alert severity raised by this frame, frontend spelling.
        detections: Foreground detections captured for this frame, if any
            were stashed in ``metadata`` at write time. Empty for events
            written before this field existed.
        confidence: Strongest detection score in this frame, or ``None``.
    """

    id: int
    ts: datetime
    ear: float | None = None
    mar: float | None = None
    head_pitch: float | None = None
    head_yaw: float | None = None
    head_roll: float | None = None
    eye_closed: bool | None = None
    yawning: bool | None = None
    state: str
    fatigue_score: int | None = None
    alert_level: str
    detections: list[Detection] = Field(default_factory=list)
    confidence: float | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> DetectionEvent:
        """Build an event from a raw ``detection_events`` row.

        Args:
            row: The dict returned by the Supabase client.

        Returns:
            A populated :class:`DetectionEvent`.
        """
        metadata = row.get("metadata") or {}
        detections = [Detection(**d) for d in metadata.get("detections", [])]
        return cls(
            id=row["id"],
            ts=row["ts"],
            ear=row.get("ear"),
            mar=row.get("mar"),
            head_pitch=row.get("head_pitch"),
            head_yaw=row.get("head_yaw"),
            head_roll=row.get("head_roll"),
            eye_closed=row.get("eye_closed"),
            yawning=row.get("yawning"),
            state=DriverState(row["state"]).api_label,
            fatigue_score=_scaled_fatigue(row.get("fatigue_score")),
            alert_level=AlertLevel(row["alert_level"]).api_label,
            detections=detections,
            confidence=max((d.score for d in detections), default=None),
        )


class DetectionEventInput(BaseModel):
    """One event as submitted by a client completing a webcam session.

    Mirrors what ``POST /analysis/image`` already hands the client back per
    tick (frontend spelling for ``state``/``alert_level``), so the frontend
    forwards that response almost verbatim rather than re-deriving anything.

    Attributes:
        t: Offset from the start of the recording, seconds.
        ear: Derived eye-aspect-ratio proxy, ``None`` when not computable.
        mar: Derived mouth-aspect-ratio proxy, ``None`` when not computable.
        eye_closed: Whether the eyes were classified closed this frame.
        yawning: Whether a yawn was classified this frame.
        state: Classified state, frontend spelling (e.g. ``"AWAKE"``).
        alert_level: Alert severity, frontend spelling (e.g. ``"SAFE"``).
        fatigue_score: Fatigue on the 0-100 scale, as served by
            ``/analysis/image``.
        detections: Foreground detections for this frame, if any.
    """

    t: float = Field(ge=0.0, description="Offset from recording start, seconds.")
    ear: float | None = None
    mar: float | None = None
    eye_closed: bool = False
    yawning: bool = False
    state: str = Field(description="Classified state, frontend spelling.")
    alert_level: str = Field(description="Alert severity, frontend spelling.")
    fatigue_score: int = Field(ge=0, le=100)
    detections: list[Detection] = Field(default_factory=list)

    def to_domain_state(self) -> DriverState:
        """Translate ``state`` back to the persisted :class:`DriverState`.

        Returns:
            The matching enum member.
        """
        return DriverState(self.state.lower())

    def to_domain_alert_level(self) -> AlertLevel:
        """Translate ``alert_level`` back to the persisted :class:`AlertLevel`.

        Returns:
            The matching enum member.
        """
        return API_LABEL_TO_ALERT_LEVEL[self.alert_level]
