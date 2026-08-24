"""API tests for the upload-to-session endpoints.

Follows the combined pattern of ``test_sessions.py`` (authenticated,
writable-Supabase-client fakes) and ``test_video_analysis.py`` (a real
tiny video fixture plus an overridden model manager) - these routes need
both: real auth and a real fake write path.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import cv2
import numpy as np
import pytest

from app.core.constants import AppRole
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_supabase_client
from app.dependencies.model import get_model_manager
from app.domain.models.base import RawDetection
from app.schemas.auth import AuthenticatedUser

pytestmark = pytest.mark.api

USER_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
SESSION_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
NOW = "2026-01-15T12:00:00+00:00"

JWT_SETTINGS = {
    "supabase_url": "https://testref.supabase.co",
    "supabase_service_role_key": "test-service-role-key",
}


class _FakeManager:
    def __init__(self, detections: list[RawDetection] | None = None) -> None:
        self._detections = detections or []

    def predict(self, _image_rgb: np.ndarray) -> list[RawDetection]:
        return self._detections


class _FakeQuery:
    """Returns the same canned row(s) regardless of the filter chain applied."""

    def __init__(self, rows: Any, count: int | None = None) -> None:
        self._rows = rows
        self._count = count

    def select(self, *_columns: Any, **_kwargs: Any) -> _FakeQuery:
        return self

    def eq(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        return self

    def order(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        return self

    def range(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        return self

    def maybe_single(self) -> _FakeQuery:
        return self

    def insert(self, payload: dict[str, Any] | list[dict[str, Any]]) -> _FakeQuery:
        generated = {"id": SESSION_ID, "created_at": NOW, "updated_at": NOW}
        if isinstance(payload, list):
            self._rows = [{**generated, **item} for item in payload]
        else:
            self._rows = [{**generated, **payload}]
        return self

    async def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._rows, count=self._count)


class _FakeStorageBucket:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, str, int]] = []
        self._bucket = ""

    def from_(self, bucket: str) -> _FakeStorageBucket:
        self._bucket = bucket
        return self

    async def upload(self, path: str, content: bytes, _options: dict[str, str]) -> None:
        self.uploads.append((self._bucket, path, len(content)))


class _FakeWritableSupabaseClient:
    def __init__(self) -> None:
        self.storage = _FakeStorageBucket()
        self._tables = {
            "detection_sessions": _FakeQuery(None),
            "detection_events": _FakeQuery(None),
            "uploaded_media": _FakeQuery(None),
        }

    def table(self, name: str) -> _FakeQuery:
        return self._tables[name]


def override_current_user(app: Any, *, role: AppRole = AppRole.USER) -> None:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=UUID(USER_ID), role=role
    )


def override_manager(app: Any, manager: _FakeManager) -> None:
    app.dependency_overrides[get_model_manager] = lambda: manager


def _write_test_video(path: Path, *, frame_count: int, fps: float, size: tuple[int, int]) -> None:
    width, height = size
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    assert writer.isOpened()
    for i in range(frame_count):
        writer.write(np.full((height, width, 3), fill_value=i % 256, dtype=np.uint8))
    writer.release()


@pytest.fixture
def video_file(tmp_path: Path) -> Path:
    path = tmp_path / "clip.mp4"
    _write_test_video(path, frame_count=20, fps=10.0, size=(64, 48))
    return path


@pytest.fixture
def image_bytes() -> bytes:
    frame = np.full((48, 64, 3), fill_value=127, dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", frame)
    assert ok
    return encoded.tobytes()


class TestUploadVideoEndpoint:
    def test_requires_auth(self, make_client: Any, video_file: Path) -> None:
        with make_client(**JWT_SETTINGS) as active_client, video_file.open("rb") as fh:
            response = active_client.post(
                "/api/v1/uploads/video", files={"file": ("clip.mp4", fh, "video/mp4")}
            )
        assert response.status_code == 401

    def test_persists_a_real_video_session(self, make_client: Any, video_file: Path) -> None:
        built = make_client()
        override_current_user(built.app)
        override_manager(
            built.app,
            _FakeManager([RawDetection(label_index=2, score=0.8, x1=0, y1=0, x2=5, y2=5)]),
        )
        fake = _FakeWritableSupabaseClient()
        built.app.dependency_overrides[get_supabase_client] = lambda: fake

        with built as active_client, video_file.open("rb") as fh:
            response = active_client.post(
                "/api/v1/uploads/video",
                files={"file": ("clip.mp4", fh, "video/mp4")},
                data={"sample_rate": "2"},
            )

        assert response.status_code == 200
        payload = response.json()["data"]
        assert payload["source"] == "video"
        assert payload["status"] == "completed"
        assert payload["media"]["bucket"] == "session-clips"

        assert len(fake.storage.uploads) == 1
        bucket, path, size = fake.storage.uploads[0]
        assert bucket == "session-clips"
        assert path.startswith(f"{USER_ID}/")
        assert size > 0

    def test_rejects_unsupported_mime_type(self, make_client: Any, video_file: Path) -> None:
        built = make_client()
        override_current_user(built.app)
        override_manager(built.app, _FakeManager())
        built.app.dependency_overrides[get_supabase_client] = lambda: _FakeWritableSupabaseClient()

        with built as active_client, video_file.open("rb") as fh:
            response = active_client.post(
                "/api/v1/uploads/video", files={"file": ("clip.txt", fh, "text/plain")}
            )
        assert response.status_code == 415


class TestUploadImageEndpoint:
    def test_requires_auth(self, make_client: Any, image_bytes: bytes) -> None:
        with make_client(**JWT_SETTINGS) as active_client:
            response = active_client.post(
                "/api/v1/uploads/image", files={"file": ("frame.jpg", image_bytes, "image/jpeg")}
            )
        assert response.status_code == 401

    def test_persists_a_real_image_session(self, make_client: Any, image_bytes: bytes) -> None:
        built = make_client()
        override_current_user(built.app)
        override_manager(
            built.app,
            _FakeManager([RawDetection(label_index=1, score=0.9, x1=0, y1=0, x2=5, y2=5)]),
        )
        fake = _FakeWritableSupabaseClient()
        built.app.dependency_overrides[get_supabase_client] = lambda: fake

        with built as active_client:
            response = active_client.post(
                "/api/v1/uploads/image", files={"file": ("frame.jpg", image_bytes, "image/jpeg")}
            )

        assert response.status_code == 200
        payload = response.json()["data"]
        assert payload["source"] == "image"
        assert payload["status"] == "completed"
        assert payload["media"]["bucket"] == "uploads-images"
        assert payload["final_state"] == "SLEEPING"

        assert len(fake.storage.uploads) == 1
        bucket, path, size = fake.storage.uploads[0]
        assert bucket == "uploads-images"
        assert path.startswith(f"{USER_ID}/")
        assert size > 0

    def test_rejects_unsupported_mime_type(self, make_client: Any, image_bytes: bytes) -> None:
        built = make_client()
        override_current_user(built.app)
        override_manager(built.app, _FakeManager())
        built.app.dependency_overrides[get_supabase_client] = lambda: _FakeWritableSupabaseClient()

        with built as active_client:
            response = active_client.post(
                "/api/v1/uploads/image", files={"file": ("frame.txt", image_bytes, "text/plain")}
            )
        assert response.status_code == 415
