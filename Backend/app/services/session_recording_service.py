"""Webcam session recording service (Phase F write path).

Takes a completed webcam monitoring session - the real events a client
collected locally by calling ``POST /analysis/image`` on a timer, plus the
``MediaRecorder`` recording of that same session - and persists it in one
shot: burns each frame with its nearest event's real detections and a
state/fatigue HUD (reusing the video-analysis annotation pipeline exactly -
``video_overlay.draw_overlay`` and ``video_encoder.FrameEncoder`` - no new
drawing or encoding code), uploads the annotated result to Supabase Storage,
and inserts the session and event rows.

One-shot by design: a start/append/finish lifecycle would leave an orphaned
"active" row on a crash mid-session. This cannot - either the whole session
lands, or none of it does.
"""

from __future__ import annotations

import contextlib
import os
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Any

from fastapi.concurrency import run_in_threadpool

from app.core.constants import (
    ALLOWED_RECORDING_MIME_TYPES,
    BUCKET_SESSION_CLIPS,
    DEFAULT_VIDEO_FALLBACK_FPS,
    FATIGUE_API_SCALE,
    MAX_ANNOTATED_VIDEO_FRAMES,
    DriverState,
    MediaKind,
    SessionSource,
    SessionStatus,
)
from app.core.exceptions import UnsupportedMediaError, VideoProcessingError
from app.core.logging import get_logger
from app.domain.analysis import AnalyzedDetection, DerivedMetrics, FrameAnalysis
from app.domain.video_analysis import (
    FrameSample,
    count_alert_episodes,
    count_yawn_onsets,
    cumulative_eye_closure_seconds,
)
from app.infra.storage import upload_bytes
from app.infra.video_encoder import FrameEncoder
from app.schemas.sessions import SessionDetail
from app.services.video_overlay import draw_overlay

if TYPE_CHECKING:
    from datetime import datetime
    from uuid import UUID

    from supabase import AsyncClient

    from app.infra.repositories.media_repository import MediaRepository
    from app.infra.repositories.session_repository import SessionRepository
    from app.schemas.auth import AuthenticatedUser
    from app.schemas.sessions import DetectionEventInput

logger = get_logger(__name__)


class SessionRecordingService:
    """Persists one completed webcam monitoring session, recording included.

    Args:
        sessions: Writes the session and event rows.
        media: Writes the uploaded-media row.
        storage_client: The service-role Supabase client, for the Storage
            upload - ``session-clips`` grants no ``authenticated`` INSERT
            policy, so only this client can write there.
    """

    def __init__(
        self,
        sessions: SessionRepository,
        media: MediaRepository,
        storage_client: AsyncClient,
    ) -> None:
        """Bind the injected repositories and storage client."""
        self._sessions = sessions
        self._media = media
        self._client = storage_client

    async def complete_session(
        self,
        user: AuthenticatedUser,
        *,
        recording: bytes,
        recording_content_type: str | None,
        started_at: datetime,
        events: list[DetectionEventInput],
    ) -> SessionDetail:
        """Validate, annotate, store and persist one completed session.

        Args:
            user: The authenticated caller. Every written row belongs to
                this user, never trusted from the request body.
            recording: Raw bytes of the ``MediaRecorder`` output.
            recording_content_type: Declared MIME type, or ``None``.
            started_at: Wall-clock time the session began.
            events: The events the client collected during the session, in
                time order.

        Returns:
            The newly created session, in the same shape ``GET
            /sessions/{id}`` returns.

        Raises:
            UnsupportedMediaError: The recording's MIME type is not accepted,
                it is empty, or it could not be decoded.
            VideoProcessingError: Annotating or re-encoding the recording
                failed.
            DatabaseError: A write failed.
            StorageError: The upload failed.
        """
        self._validate(recording, recording_content_type)
        samples = [self._to_frame_sample(event) for event in events]

        annotated, duration_sec = await run_in_threadpool(
            self._render_annotated_sync, recording, samples
        )

        media_row = await self._store_recording(user.id, annotated, duration_sec=duration_sec)

        session_payload = self._session_payload(
            media_id=media_row["id"],
            started_at=started_at,
            duration_sec=duration_sec,
            samples=samples,
        )
        session_row = await self._sessions.create_session(user.id, session_payload)
        await self._sessions.insert_events(
            user.id,
            session_row["id"],
            [self._event_row(event, started_at=started_at) for event in events],
        )
        return SessionDetail.from_row(session_row, media_row)

    @staticmethod
    def _validate(content: bytes, content_type: str | None) -> None:
        """Enforce MIME type and non-emptiness before spending work on decoding.

        Args:
            content: Raw recording bytes.
            content_type: Declared MIME type.

        Raises:
            UnsupportedMediaError: Unaccepted MIME type, or empty content.
        """
        if (
            content_type is None
            or content_type.split(";")[0].strip() not in ALLOWED_RECORDING_MIME_TYPES
        ):
            raise UnsupportedMediaError("Recording must be WebM or MP4.")
        if not content:
            raise UnsupportedMediaError("The recording is empty.")

    @staticmethod
    def _to_frame_sample(event: DetectionEventInput) -> FrameSample:
        """Convert one submitted event into the shared domain frame type.

        This is what makes the rest of the pipeline reusable verbatim: once
        an event is a :class:`FrameSample`, ``draw_overlay``,
        ``count_yawn_onsets`` and ``count_alert_episodes`` cannot tell it
        apart from a sampled video frame.

        Args:
            event: One event as submitted by the client.

        Returns:
            The equivalent :class:`~app.domain.video_analysis.FrameSample`.
        """
        detections = [
            AnalyzedDetection(
                label=det.label,
                label_index=det.label_index,
                score=det.score,
                x1=det.box.x1,
                y1=det.box.y1,
                x2=det.box.x2,
                y2=det.box.y2,
            )
            for det in event.detections
        ]
        analysis = FrameAnalysis(
            driver_state=event.to_domain_state(),
            alert_level=event.to_domain_alert_level(),
            fatigue_score=event.fatigue_score / FATIGUE_API_SCALE,
            detections=detections,
            metrics=DerivedMetrics(
                eye_aspect_ratio=event.ear,
                mouth_aspect_ratio=event.mar,
                eyes_closed=event.eye_closed,
                yawning=event.yawning,
            ),
        )
        return FrameSample(t=event.t, analysis=analysis)

    def _render_annotated_sync(
        self, recording: bytes, samples: list[FrameSample]
    ) -> tuple[bytes, float]:
        """Decode the recording, burn in the nearest sample per frame, re-encode.

        Runs in a worker thread. Every frame is processed (up to the frame
        cap) - there is no model forward pass here, only drawing and
        encoding, so unlike video analysis there is no separate sampling
        step to bound.

        Args:
            recording: Raw recording bytes.
            samples: The session's events as frame samples, in time order.

        Returns:
            The annotated MP4's bytes and its duration in seconds.

        Raises:
            UnsupportedMediaError: The recording could not be decoded.
            VideoProcessingError: Encoding failed.
        """
        import cv2

        input_fd, input_name = tempfile.mkstemp(suffix=".webm")
        with os.fdopen(input_fd, "wb") as handle:
            handle.write(recording)
        input_path = Path(input_name)

        output_fd, output_name = tempfile.mkstemp(suffix=".mp4")
        os.close(output_fd)
        output_path = Path(output_name)

        capture = cv2.VideoCapture(str(input_path))
        if not capture.isOpened():
            capture.release()
            input_path.unlink(missing_ok=True)
            output_path.unlink(missing_ok=True)
            raise UnsupportedMediaError("The recording could not be decoded.")

        try:
            fps = capture.get(cv2.CAP_PROP_FPS) or DEFAULT_VIDEO_FALLBACK_FPS
            width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
            height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
            if width <= 0 or height <= 0:
                raise UnsupportedMediaError("The recording could not be decoded.")

            encoder = FrameEncoder()
            encoder.start(output_path, width=width, height=height, fps=fps)

            index = 0
            pointer = 0
            try:
                while index < MAX_ANNOTATED_VIDEO_FRAMES:
                    ok, frame = capture.read()
                    if not ok:
                        break
                    t = index / fps
                    while pointer + 1 < len(samples) and samples[pointer + 1].t <= t:
                        pointer += 1
                    current = samples[pointer] if samples and samples[0].t <= t else None
                    draw_overlay(frame, current)
                    encoder.write(frame)
                    index += 1
            except Exception:
                with contextlib.suppress(VideoProcessingError):
                    encoder.finish()
                raise
            encoder.finish()

            duration_sec = index / fps if fps > 0 else 0.0
            return output_path.read_bytes(), duration_sec
        finally:
            capture.release()
            input_path.unlink(missing_ok=True)
            output_path.unlink(missing_ok=True)

    async def _store_recording(
        self, user_id: UUID, annotated: bytes, *, duration_sec: float
    ) -> dict[str, Any]:
        """Upload the annotated recording and record it in ``uploaded_media``.

        Args:
            user_id: The Supabase user id the recording belongs to.
            annotated: The annotated MP4's bytes.
            duration_sec: The recording's duration, seconds.

        Returns:
            The inserted ``uploaded_media`` row.
        """
        path = f"{user_id}/{uuid.uuid4().hex}.mp4"
        await upload_bytes(
            self._client,
            bucket=BUCKET_SESSION_CLIPS,
            path=path,
            content=annotated,
            content_type="video/mp4",
        )
        return await self._media.create_media(
            user_id,
            {
                "bucket": BUCKET_SESSION_CLIPS,
                "storage_path": path,
                "mime_type": "video/mp4",
                "size_bytes": len(annotated),
                "duration_seconds": round(duration_sec, 2),
                "kind": MediaKind.VIDEO.value,
            },
        )

    @staticmethod
    def _session_payload(
        *,
        media_id: str,
        started_at: datetime,
        duration_sec: float,
        samples: list[FrameSample],
    ) -> dict[str, Any]:
        """Build the ``detection_sessions`` row from the session's events.

        Args:
            media_id: The linked ``uploaded_media`` row's id.
            started_at: Wall-clock time the session began.
            duration_sec: The recording's real decoded duration.
            samples: The session's events as frame samples, in time order.

        Returns:
            Column values ready for
            :meth:`~app.infra.repositories.session_repository.SessionRepository.create_session`.
        """
        final_state = samples[-1].analysis.driver_state if samples else DriverState.UNKNOWN
        fatigue_scores = [s.analysis.fatigue_score for s in samples]
        return {
            "source": SessionSource.WEBCAM.value,
            "status": SessionStatus.COMPLETED.value,
            "media_id": media_id,
            "started_at": started_at.isoformat(),
            "ended_at": (started_at + timedelta(seconds=duration_sec)).isoformat(),
            "duration_seconds": round(duration_sec, 2),
            "total_events": len(samples),
            "total_alerts": count_alert_episodes(samples),
            "yawn_count": count_yawn_onsets(samples),
            "eye_closure_seconds": cumulative_eye_closure_seconds(samples),
            "max_fatigue_score": max(fatigue_scores, default=0.0),
            "final_state": final_state.value,
        }

    @staticmethod
    def _event_row(event: DetectionEventInput, *, started_at: datetime) -> dict[str, Any]:
        """Build one ``detection_events`` row from a submitted event.

        Args:
            event: One event as submitted by the client.
            started_at: Wall-clock time the session began - ``ts`` is a real
                timestamp column, so ``event.t`` (seconds since start) is
                converted back to an absolute time here.

        Returns:
            Column values ready for
            :meth:`~app.infra.repositories.session_repository.SessionRepository.insert_events`.
        """
        metadata = (
            {"detections": [det.model_dump(mode="json") for det in event.detections]}
            if event.detections
            else {}
        )
        return {
            "ts": (started_at + timedelta(seconds=event.t)).isoformat(),
            "ear": event.ear,
            "mar": event.mar,
            "eye_closed": event.eye_closed,
            "yawning": event.yawning,
            "state": event.to_domain_state().value,
            "fatigue_score": event.fatigue_score / FATIGUE_API_SCALE,
            "alert_level": event.to_domain_alert_level().value,
            "metadata": metadata,
        }
