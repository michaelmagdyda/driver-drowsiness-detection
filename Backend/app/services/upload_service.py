"""Upload-to-session service (Phase F write path, upload flow).

Wires the "Upload media" page to the real analysis pipeline instead of the
dead-end it used to be (a direct-to-Storage upload with no analysis at
all): an uploaded video or image is run through the same detector as every
other entry point (:class:`~app.services.video_analysis_service.VideoAnalysisService`
/ :class:`~app.services.analysis_service.AnalysisService`), annotated with
the same :func:`~app.services.video_overlay.draw_overlay` burned-in
boxes/HUD used for video previews and webcam sessions, stored in Supabase
Storage, and persisted as a ``detection_sessions`` row (plus its
``detection_events``) so the upload shows up in History exactly like a
webcam session does.

Deliberately reuses :mod:`app.domain.video_analysis`'s aggregation helpers
and :mod:`app.services.session_recording_service`'s established
conventions (``final_state`` = the last frame's state, not the worst state
seen) rather than inventing a third copy of the same logic.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from fastapi.concurrency import run_in_threadpool

from app.core.constants import (
    BUCKET_SESSION_CLIPS,
    MEDIA_KIND_BUCKET,
    DriverState,
    MediaKind,
    SessionSource,
    SessionStatus,
)
from app.core.exceptions import VideoProcessingError
from app.domain.video_analysis import (
    FrameSample,
    count_alert_episodes,
    count_yawn_onsets,
    cumulative_eye_closure_seconds,
)
from app.infra.storage import upload_bytes
from app.schemas.sessions import SessionDetail
from app.services import preview_store
from app.services.analysis_service import AnalysisService
from app.services.video_analysis_service import VideoAnalysisService
from app.services.video_overlay import draw_overlay

if TYPE_CHECKING:
    from uuid import UUID

    from supabase import AsyncClient

    from app.domain.analysis import FrameAnalysis
    from app.domain.models.manager import ModelManager
    from app.domain.video_analysis import VideoAnalysis
    from app.infra.repositories.media_repository import MediaRepository
    from app.infra.repositories.session_repository import SessionRepository
    from app.schemas.auth import AuthenticatedUser


class UploadService:
    """Analyses an uploaded video or image and stores it as a session.

    Args:
        manager: The loaded model manager, forwarded to the existing
            analysis services rather than driven directly here.
        sessions: Writes the session and event rows.
        media: Writes the uploaded-media row.
        storage_client: The service-role Supabase client, for the Storage
            upload.
        max_video_bytes: Upload size limit forwarded to
            :class:`VideoAnalysisService`.
        max_image_bytes: Upload size limit forwarded to
            :class:`AnalysisService`.
    """

    def __init__(
        self,
        manager: ModelManager,
        sessions: SessionRepository,
        media: MediaRepository,
        storage_client: AsyncClient,
        *,
        max_video_bytes: int,
        max_image_bytes: int,
    ) -> None:
        """Bind the injected collaborators and upload size limits."""
        self._manager = manager
        self._sessions = sessions
        self._media = media
        self._client = storage_client
        self._max_video_bytes = max_video_bytes
        self._max_image_bytes = max_image_bytes

    async def save_video(
        self,
        user: AuthenticatedUser,
        *,
        content: bytes,
        content_type: str | None,
        filename: str | None,
        sample_rate: float,
    ) -> SessionDetail:
        """Analyse an uploaded video and persist it as a completed session.

        Reuses :class:`VideoAnalysisService` verbatim for validation,
        sampling, inference and annotation - the only new work here is
        turning its output into ``detection_sessions``/``detection_events``
        rows instead of a one-off response.

        Args:
            user: The authenticated caller. Every written row belongs to
                this user.
            content: Raw bytes of the uploaded video.
            content_type: Declared MIME type, or ``None``.
            filename: Original filename.
            sample_rate: Requested samples-per-second.

        Returns:
            The newly created session, in the same shape ``GET
            /sessions/{id}`` returns.

        Raises:
            UnsupportedMediaError: Not an accepted video, or undecodable.
            FileTooLargeError: Over the configured size limit.
            VideoProcessingError: Analysis failed, or no annotated preview
                could be produced or retrieved.
            DatabaseError: A write failed.
            StorageError: The upload failed.
        """
        video_service = VideoAnalysisService(self._manager, max_video_bytes=self._max_video_bytes)
        analysis = await video_service.analyze_video(
            content=content,
            content_type=content_type,
            filename=filename,
            sample_rate=sample_rate,
        )
        if analysis.preview_token is None:
            raise VideoProcessingError(
                "The video was analysed, but an annotated copy could not be generated."
            )
        annotated_path = preview_store.resolve(analysis.preview_token)
        if annotated_path is None:
            raise VideoProcessingError("The generated preview is no longer available.")
        annotated_bytes = annotated_path.read_bytes()

        started_at = datetime.now(UTC)
        media_row = await self._store_media(
            user.id,
            annotated_bytes,
            bucket=BUCKET_SESSION_CLIPS,
            extension="mp4",
            content_type="video/mp4",
            kind=MediaKind.VIDEO,
            duration_seconds=analysis.duration_sec,
        )
        session_payload = self._video_session_payload(
            media_id=media_row["id"], started_at=started_at, analysis=analysis
        )
        session_row = await self._sessions.create_session(user.id, session_payload)
        await self._sessions.insert_events(
            user.id,
            session_row["id"],
            [self._frame_event_row(sample, started_at=started_at) for sample in analysis.frames],
        )
        return SessionDetail.from_row(session_row, media_row)

    async def save_image(
        self,
        user: AuthenticatedUser,
        *,
        content: bytes,
        content_type: str | None,
    ) -> SessionDetail:
        """Analyse an uploaded image and persist it as a completed session.

        Reuses :class:`AnalysisService` for validation, decoding and
        inference, then applies the same :func:`draw_overlay` used for
        video and webcam frames to the single decoded image.

        Args:
            user: The authenticated caller. Every written row belongs to
                this user.
            content: Raw bytes of the uploaded image.
            content_type: Declared MIME type, or ``None``.

        Returns:
            The newly created session, in the same shape ``GET
            /sessions/{id}`` returns.

        Raises:
            UnsupportedMediaError: Not an accepted image, or undecodable.
            FileTooLargeError: Over the configured size limit.
            VideoProcessingError: The annotated image could not be encoded.
            DatabaseError: A write failed.
            StorageError: The upload failed.
        """
        image_service = AnalysisService(self._manager, max_image_bytes=self._max_image_bytes)
        analysis = await image_service.analyze_image(content=content, content_type=content_type)
        annotated_bytes = await run_in_threadpool(
            self._render_annotated_image_sync, content, analysis
        )

        started_at = datetime.now(UTC)
        media_row = await self._store_media(
            user.id,
            annotated_bytes,
            bucket=MEDIA_KIND_BUCKET[MediaKind.IMAGE],
            extension="jpg",
            content_type="image/jpeg",
            kind=MediaKind.IMAGE,
            duration_seconds=None,
        )
        sample = FrameSample(t=0.0, analysis=analysis)
        session_payload = self._image_session_payload(
            media_id=media_row["id"], started_at=started_at, sample=sample
        )
        session_row = await self._sessions.create_session(user.id, session_payload)
        await self._sessions.insert_events(
            user.id, session_row["id"], [self._frame_event_row(sample, started_at=started_at)]
        )
        return SessionDetail.from_row(session_row, media_row)

    @staticmethod
    def _render_annotated_image_sync(content: bytes, analysis: FrameAnalysis) -> bytes:
        """Decode the original bytes, burn in the real detections, re-encode as JPEG.

        Runs in a worker thread purely for consistency with the other
        encode paths; a single image is cheap enough that this is not a
        performance requirement.

        Args:
            content: Raw bytes of the uploaded image. Decoded a second time
                here (in BGR) since :class:`AnalysisService` only keeps the
                RGB array it fed the model.
            analysis: The already-computed classification for this image.

        Returns:
            The annotated image, encoded as JPEG bytes.

        Raises:
            VideoProcessingError: JPEG encoding failed.
        """
        import cv2
        import numpy as np

        buffer = np.frombuffer(content, dtype=np.uint8)
        frame_bgr = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
        draw_overlay(frame_bgr, FrameSample(t=0.0, analysis=analysis))
        ok, encoded = cv2.imencode(".jpg", frame_bgr)
        if not ok:
            raise VideoProcessingError("The annotated image could not be encoded.")
        return encoded.tobytes()

    async def _store_media(
        self,
        user_id: UUID,
        content: bytes,
        *,
        bucket: str,
        extension: str,
        content_type: str,
        kind: MediaKind,
        duration_seconds: float | None,
    ) -> dict[str, Any]:
        """Upload annotated bytes and record them in ``uploaded_media``.

        Args:
            user_id: The Supabase user id the media belongs to.
            content: The annotated file's bytes.
            bucket: Destination Storage bucket.
            extension: File extension for the generated object path.
            content_type: MIME type to store.
            kind: ``uploaded_media.kind`` value.
            duration_seconds: Media duration, or ``None`` for a still image.

        Returns:
            The inserted ``uploaded_media`` row.
        """
        path = f"{user_id}/{uuid.uuid4().hex}.{extension}"
        await upload_bytes(
            self._client, bucket=bucket, path=path, content=content, content_type=content_type
        )
        return await self._media.create_media(
            user_id,
            {
                "bucket": bucket,
                "storage_path": path,
                "mime_type": content_type,
                "size_bytes": len(content),
                "duration_seconds": duration_seconds,
                "kind": kind.value,
            },
        )

    @staticmethod
    def _video_session_payload(
        *, media_id: str, started_at: datetime, analysis: VideoAnalysis
    ) -> dict[str, Any]:
        """Build the ``detection_sessions`` row for an uploaded video.

        ``final_state`` uses the last sampled frame's state, not
        ``analysis.driver_state`` (the worst state seen) - the same
        override :class:`~app.services.session_recording_service.SessionRecordingService`
        applies, since ``SessionSummary.final_state`` is documented as
        "state at the end", not "worst state".

        Args:
            media_id: The linked ``uploaded_media`` row's id.
            started_at: Wall-clock time the upload was processed.
            analysis: The video's aggregated analysis.

        Returns:
            Column values ready for
            :meth:`~app.infra.repositories.session_repository.SessionRepository.create_session`.
        """
        frames = analysis.frames
        final_state = frames[-1].analysis.driver_state if frames else DriverState.UNKNOWN
        return {
            "source": SessionSource.VIDEO.value,
            "status": SessionStatus.COMPLETED.value,
            "media_id": media_id,
            "started_at": started_at.isoformat(),
            "ended_at": (started_at + timedelta(seconds=analysis.duration_sec)).isoformat(),
            "duration_seconds": analysis.duration_sec,
            "total_events": len(frames),
            "total_alerts": count_alert_episodes(frames),
            "yawn_count": count_yawn_onsets(frames),
            "eye_closure_seconds": cumulative_eye_closure_seconds(frames),
            "max_fatigue_score": analysis.max_fatigue_score,
            "final_state": final_state.value,
        }

    @staticmethod
    def _image_session_payload(
        *, media_id: str, started_at: datetime, sample: FrameSample
    ) -> dict[str, Any]:
        """Build the ``detection_sessions`` row for an uploaded still image.

        A single image has no time dimension, so the same aggregation
        helpers used for a whole clip degrade to their honest single-frame
        answer (one event, zero cumulative eye closure - there is nothing
        to accumulate over) rather than needing separate logic.

        Args:
            media_id: The linked ``uploaded_media`` row's id.
            started_at: Wall-clock time the upload was processed.
            sample: The image wrapped as a single-frame sample.

        Returns:
            Column values ready for
            :meth:`~app.infra.repositories.session_repository.SessionRepository.create_session`.
        """
        frames = [sample]
        return {
            "source": SessionSource.IMAGE.value,
            "status": SessionStatus.COMPLETED.value,
            "media_id": media_id,
            "started_at": started_at.isoformat(),
            "ended_at": started_at.isoformat(),
            "duration_seconds": 0.0,
            "total_events": 1,
            "total_alerts": count_alert_episodes(frames),
            "yawn_count": count_yawn_onsets(frames),
            "eye_closure_seconds": cumulative_eye_closure_seconds(frames),
            "max_fatigue_score": sample.analysis.fatigue_score,
            "final_state": sample.analysis.driver_state.value,
        }

    @staticmethod
    def _frame_event_row(sample: FrameSample, *, started_at: datetime) -> dict[str, Any]:
        """Build one ``detection_events`` row from an analysed frame.

        Mirrors :meth:`~app.services.session_recording_service.SessionRecordingService._event_row`'s
        shape exactly (the same ``metadata.detections`` convention
        :meth:`~app.schemas.sessions.DetectionEvent.from_row` reads back),
        but is sourced from a domain :class:`FrameSample` directly rather
        than a wire ``DetectionEventInput``, since uploaded media never
        goes through that wire schema.

        Args:
            sample: One analysed frame.
            started_at: Wall-clock time the session began - ``ts`` is a
                real timestamp column, so ``sample.t`` (seconds since
                start) is converted back to an absolute time here.

        Returns:
            Column values ready for
            :meth:`~app.infra.repositories.session_repository.SessionRepository.insert_events`.
        """
        analysis = sample.analysis
        metrics = analysis.metrics
        metadata = (
            {
                "detections": [
                    {
                        "label": det.label,
                        "label_index": det.label_index,
                        "score": det.score,
                        "box": {"x1": det.x1, "y1": det.y1, "x2": det.x2, "y2": det.y2},
                    }
                    for det in analysis.detections
                ]
            }
            if analysis.detections
            else {}
        )
        return {
            "ts": (started_at + timedelta(seconds=sample.t)).isoformat(),
            "ear": metrics.eye_aspect_ratio if metrics else None,
            "mar": metrics.mouth_aspect_ratio if metrics else None,
            "eye_closed": metrics.eyes_closed if metrics else False,
            "yawning": metrics.yawning if metrics else False,
            "state": analysis.driver_state.value,
            "fatigue_score": analysis.fatigue_score,
            "alert_level": analysis.alert_level.value,
            "metadata": metadata,
        }
