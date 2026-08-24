"""Unit tests for :mod:`app.services.upload_service`.

Both paths run against real media: a tiny MP4 written with OpenCV's own
``VideoWriter`` (the same fixture pattern as
``test_video_analysis_service.py``) for ``save_video``, and a real encoded
JPEG for ``save_image`` - not mocks of the decode/encode pipeline.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

import numpy as np
import pytest

from app.core.constants import AppRole
from app.core.exceptions import UnsupportedMediaError
from app.domain.models.base import RawDetection
from app.schemas.auth import AuthenticatedUser
from app.services import preview_store
from app.services.upload_service import UploadService

pytestmark = pytest.mark.unit

USER_ID = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
USER = AuthenticatedUser(id=USER_ID, role=AppRole.USER)
SESSION_ID = UUID("7c9e6679-7425-40de-944b-e07fc1f90ae7")
MEDIA_ID = UUID("11111111-1111-1111-1111-111111111111")


@pytest.fixture(autouse=True)
def _clear_preview_registry() -> None:
    """Isolate each test's annotated-preview registrations from the others."""
    preview_store._entries.clear()  # noqa: SLF001 - test-only reach into module state


class _FakeManager:
    """Stands in for ModelManager: no torch, no lock, canned detections."""

    def __init__(self, detections: list[RawDetection] | None = None) -> None:
        self._detections = detections or []
        self.calls = 0

    def predict(self, _image_rgb: np.ndarray) -> list[RawDetection]:
        self.calls += 1
        return self._detections


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
            "created_at": "2026-01-15T12:00:00+00:00",
            "updated_at": "2026-01-15T12:00:00+00:00",
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


def make_service(
    manager: _FakeManager | None = None,
) -> tuple[UploadService, _FakeSessionRepository, _FakeMediaRepository, _FakeStorageClient]:
    sessions = _FakeSessionRepository()
    media = _FakeMediaRepository()
    storage_client = _FakeStorageClient()
    service = UploadService(
        manager or _FakeManager(),
        sessions,
        media,
        storage_client,  # type: ignore[arg-type]
        max_video_bytes=50_000_000,
        max_image_bytes=10_000_000,
    )
    return service, sessions, media, storage_client


def _write_test_video(path: Path, *, frame_count: int, fps: float, size: tuple[int, int]) -> None:
    import cv2

    width, height = size
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    assert writer.isOpened(), "Test fixture could not open a VideoWriter - codec unavailable."
    for i in range(frame_count):
        writer.write(np.full((height, width, 3), fill_value=i % 256, dtype=np.uint8))
    writer.release()


@pytest.fixture
def video_bytes(tmp_path: Path) -> bytes:
    path = tmp_path / "clip.mp4"
    _write_test_video(path, frame_count=20, fps=10.0, size=(64, 48))
    return path.read_bytes()


@pytest.fixture
def image_bytes() -> bytes:
    import cv2

    frame = np.full((48, 64, 3), fill_value=127, dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", frame)
    assert ok
    return encoded.tobytes()


class TestSaveVideo:
    async def test_persists_a_real_video_session(self, video_bytes: bytes) -> None:
        manager = _FakeManager([RawDetection(label_index=2, score=0.8, x1=0, y1=0, x2=10, y2=10)])
        service, sessions, media, storage = make_service(manager)

        result = await service.save_video(
            USER,
            content=video_bytes,
            content_type="video/mp4",
            filename="clip.mp4",
            sample_rate=2.0,
        )

        assert result.id == SESSION_ID
        assert result.media is not None
        assert result.media.bucket == "session-clips"

        assert len(storage.uploads) == 1
        bucket, path, size = storage.uploads[0]
        assert bucket == "session-clips"
        assert path.startswith(f"{USER_ID}/")
        assert path.endswith(".mp4")
        assert size > 0

        assert media.created_media is not None
        assert media.created_media["kind"] == "video"

        assert sessions.created_session is not None
        assert sessions.created_session["source"] == "video"
        assert sessions.created_session["status"] == "completed"
        assert sessions.created_session["total_events"] == manager.calls
        assert sessions.created_session["final_state"] in {
            "awake",
            "yawning",
            "drowsy",
            "sleeping",
            "unknown",
        }

        assert sessions.inserted_events is not None
        assert len(sessions.inserted_events) == manager.calls

    async def test_rejects_undecodable_video(self) -> None:
        service, *_ = make_service()
        with pytest.raises(UnsupportedMediaError):
            await service.save_video(
                USER,
                content=b"not a real video",
                content_type="video/mp4",
                filename="clip.mp4",
                sample_rate=2.0,
            )


class TestSaveImage:
    async def test_persists_a_real_image_session(self, image_bytes: bytes) -> None:
        manager = _FakeManager([RawDetection(label_index=3, score=0.7, x1=1, y1=1, x2=6, y2=6)])
        service, sessions, media, storage = make_service(manager)

        result = await service.save_image(USER, content=image_bytes, content_type="image/jpeg")

        assert result.id == SESSION_ID
        assert result.media is not None
        assert result.media.bucket == "uploads-images"

        assert len(storage.uploads) == 1
        bucket, path, size = storage.uploads[0]
        assert bucket == "uploads-images"
        assert path.startswith(f"{USER_ID}/")
        assert path.endswith(".jpg")
        assert size > 0

        assert media.created_media is not None
        assert media.created_media["kind"] == "image"
        assert media.created_media["duration_seconds"] is None

        assert sessions.created_session is not None
        assert sessions.created_session["source"] == "image"
        assert sessions.created_session["total_events"] == 1
        assert sessions.created_session["eye_closure_seconds"] == 0.0
        assert sessions.created_session["final_state"] == "yawning"

        assert sessions.inserted_events is not None
        assert len(sessions.inserted_events) == 1
        assert sessions.inserted_events[0]["metadata"]["detections"][0]["label"] == "yawn"

    async def test_rejects_undecodable_image(self) -> None:
        service, *_ = make_service()
        with pytest.raises(UnsupportedMediaError):
            await service.save_image(USER, content=b"not a real image", content_type="image/jpeg")
