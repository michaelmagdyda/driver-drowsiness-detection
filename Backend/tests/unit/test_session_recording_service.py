"""Unit tests for :mod:`app.services.session_recording_service`.

The decode/annotate/encode path runs against a real WebM file - the same
codec browsers actually produce with ``MediaRecorder`` - written by the real
bundled ffmpeg binary (``imageio_ffmpeg``), the same tool
``app.infra.video_encoder`` itself uses. This is a genuine, not mocked,
verification that OpenCV on this host can decode what a browser records.
"""

from __future__ import annotations

import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest

from app.core.constants import AppRole
from app.core.exceptions import UnsupportedMediaError
from app.schemas.analysis import BoundingBox, Detection
from app.schemas.auth import AuthenticatedUser
from app.schemas.sessions import DetectionEventInput
from app.services.session_recording_service import SessionRecordingService

pytestmark = pytest.mark.unit

USER_ID = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
USER = AuthenticatedUser(id=USER_ID, role=AppRole.USER)
SESSION_ID = UUID("7c9e6679-7425-40de-944b-e07fc1f90ae7")
MEDIA_ID = UUID("11111111-1111-1111-1111-111111111111")
STARTED_AT = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)


def _write_webm(path: Path, *, width: int, height: int, fps: float, duration: float) -> None:
    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run(  # noqa: S603 - fixed argv, no shell, binary from imageio_ffmpeg itself
        [
            ffmpeg,
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"testsrc=size={width}x{height}:rate={fps}:duration={duration}",
            "-c:v",
            "libvpx",
            "-pix_fmt",
            "yuv420p",
            str(path),
        ],
        check=True,
        capture_output=True,
    )


@pytest.fixture
def recording_bytes(tmp_path: Path) -> bytes:
    path = tmp_path / "clip.webm"
    _write_webm(path, width=64, height=48, fps=10.0, duration=2.0)
    return path.read_bytes()


def make_event(**overrides: Any) -> DetectionEventInput:
    defaults: dict[str, Any] = {
        "t": 0.0,
        "ear": 0.8,
        "mar": 0.2,
        "eye_closed": False,
        "yawning": False,
        "state": "AWAKE",
        "alert_level": "SAFE",
        "fatigue_score": 10,
        "detections": [],
    }
    defaults.update(overrides)
    return DetectionEventInput(**defaults)


class _FakeSessionRepository:
    def __init__(self) -> None:
        self.created_session: dict[str, Any] | None = None
        self.inserted_events: list[dict[str, Any]] | None = None

    async def create_session(self, user_id: UUID, row: dict[str, Any]) -> dict[str, Any]:
        self.created_session = row
        return {
            **row,
            "id": str(SESSION_ID),
            "user_id": str(user_id),
            "created_at": STARTED_AT.isoformat(),
            "updated_at": STARTED_AT.isoformat(),
        }

    async def insert_events(
        self, user_id: UUID, session_id: UUID, rows: list[dict[str, Any]]  # noqa: ARG002
    ) -> None:
        self.inserted_events = rows


class _FakeMediaRepository:
    def __init__(self) -> None:
        self.created_media: dict[str, Any] | None = None

    async def create_media(self, user_id: UUID, row: dict[str, Any]) -> dict[str, Any]:
        self.created_media = row
        return {**row, "id": str(MEDIA_ID), "user_id": str(user_id)}


class _FakeStorageBucket:
    def __init__(self, recorder: list[tuple[str, str, int]]) -> None:
        self._recorder = recorder
        self._bucket = ""

    def from_(self, bucket: str) -> _FakeStorageBucket:
        self._bucket = bucket
        return self

    async def upload(self, path: str, content: bytes, _options: dict[str, str]) -> None:
        self._recorder.append((self._bucket, path, len(content)))


class _FakeStorageClient:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, str, int]] = []
        self.storage = _FakeStorageBucket(self.uploads)


def make_service() -> (
    tuple[SessionRecordingService, _FakeSessionRepository, _FakeMediaRepository, _FakeStorageClient]
):
    sessions = _FakeSessionRepository()
    media = _FakeMediaRepository()
    storage_client = _FakeStorageClient()
    service = SessionRecordingService(sessions, media, storage_client)  # type: ignore[arg-type]
    return service, sessions, media, storage_client


class TestValidate:
    async def test_rejects_wrong_mime_type(self, recording_bytes: bytes):
        service, *_ = make_service()
        with pytest.raises(UnsupportedMediaError):
            await service.complete_session(
                USER,
                recording=recording_bytes,
                recording_content_type="video/quicktime",
                started_at=STARTED_AT,
                events=[make_event()],
            )

    async def test_rejects_empty_recording(self):
        service, *_ = make_service()
        with pytest.raises(UnsupportedMediaError):
            await service.complete_session(
                USER,
                recording=b"",
                recording_content_type="video/webm",
                started_at=STARTED_AT,
                events=[make_event()],
            )

    async def test_rejects_undecodable_recording(self):
        service, *_ = make_service()
        with pytest.raises(UnsupportedMediaError):
            await service.complete_session(
                USER,
                recording=b"not a real video",
                recording_content_type="video/webm",
                started_at=STARTED_AT,
                events=[make_event()],
            )


class TestCompleteSession:
    async def test_persists_a_real_recording_end_to_end(self, recording_bytes: bytes):
        service, sessions, media, storage = make_service()
        events = [
            make_event(t=0.0, state="AWAKE", alert_level="SAFE", eye_closed=False),
            make_event(
                t=1.0,
                state="SLEEPING",
                alert_level="EMERGENCY",
                eye_closed=True,
                detections=[
                    Detection(
                        label="closed_eye",
                        label_index=1,
                        score=0.9,
                        box=BoundingBox(x1=1, y1=1, x2=5, y2=5),
                    )
                ],
            ),
        ]

        result = await service.complete_session(
            USER,
            recording=recording_bytes,
            recording_content_type="video/webm",
            started_at=STARTED_AT,
            events=events,
        )

        assert result.id == SESSION_ID
        assert result.media is not None
        assert result.media.bucket == "session-clips"

        # Real upload happened, with a real (non-trivial) annotated file.
        assert len(storage.uploads) == 1
        bucket, path, size = storage.uploads[0]
        assert bucket == "session-clips"
        assert path.startswith(f"{USER_ID}/")
        assert path.endswith(".mp4")
        assert size > 0

        # Media row reflects the same upload.
        assert media.created_media is not None
        assert media.created_media["bucket"] == "session-clips"
        assert media.created_media["size_bytes"] == size

        # Session aggregates reflect the real events submitted.
        assert sessions.created_session is not None
        assert sessions.created_session["source"] == "webcam"
        assert sessions.created_session["status"] == "completed"
        assert sessions.created_session["final_state"] == "sleeping"
        assert sessions.created_session["total_events"] == 2

        # Events were persisted with real absolute timestamps and metadata.
        assert sessions.inserted_events is not None
        assert len(sessions.inserted_events) == 2
        assert sessions.inserted_events[1]["metadata"]["detections"][0]["label"] == "closed_eye"

    async def test_output_video_is_a_real_decodable_mp4(
        self, recording_bytes: bytes, tmp_path: Path
    ):
        service, _, _, storage = make_service()

        await service.complete_session(
            USER,
            recording=recording_bytes,
            recording_content_type="video/webm",
            started_at=STARTED_AT,
            events=[make_event()],
        )

        # Re-decode the bytes that were "uploaded" to confirm it is a real,
        # playable H.264 file - not just non-empty bytes.
        import cv2

        # The fake storage client only recorded the size, not the bytes -
        # re-render directly to get the file for this specific assertion.
        annotated, _duration = service._render_annotated_sync(recording_bytes, [])  # noqa: SLF001
        output = tmp_path / "check.mp4"
        output.write_bytes(annotated)
        capture = cv2.VideoCapture(str(output))
        try:
            assert capture.isOpened()
            decoded = 0
            while True:
                ok, _frame = capture.read()
                if not ok:
                    break
                decoded += 1
            assert decoded > 0
        finally:
            capture.release()

    async def test_no_events_yields_unknown_final_state(self, recording_bytes: bytes):
        service, sessions, *_ = make_service()

        await service.complete_session(
            USER,
            recording=recording_bytes,
            recording_content_type="video/webm",
            started_at=STARTED_AT,
            events=[],
        )

        assert sessions.created_session["final_state"] == "unknown"
        assert sessions.created_session["total_events"] == 0
