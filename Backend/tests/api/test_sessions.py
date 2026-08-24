"""API tests for the session/history endpoints.

Auth is exercised two ways: the negative cases (no header) run the *real*
``get_current_user`` dependency chain against settings with JWT verification
configured, so the 401 comes from the actual code path, not a stub. The
happy-path cases override ``get_current_user``/``get_supabase_client``
directly, following the ``app.dependency_overrides`` pattern already used by
``tests/conftest.py``.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

from app.core.constants import AppRole
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_supabase_client
from app.schemas.auth import AuthenticatedUser

pytestmark = pytest.mark.api

USER_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
SESSION_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
NOW = "2026-01-15T12:00:00+00:00"

JWT_SETTINGS = {
    "supabase_url": "https://testref.supabase.co",
    "supabase_service_role_key": "test-service-role-key",
}


class _FakeQuery:
    """Returns the same canned row(s) regardless of the filter chain applied."""

    def __init__(self, rows: Any, count: int | None = None) -> None:
        self._rows = rows
        self._count = count

    def select(self, *_columns: Any, **_kwargs: Any) -> _FakeQuery:
        return self

    def eq(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        return self

    def gte(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
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


class _FakeSupabaseClient:
    def __init__(self, tables: dict[str, _FakeQuery]) -> None:
        self._tables = tables

    def table(self, name: str) -> _FakeQuery:
        return self._tables[name]


class _FakeStorageBucket:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, str, int]] = []
        self._bucket = ""

    def from_(self, bucket: str) -> _FakeStorageBucket:
        self._bucket = bucket
        return self

    async def upload(self, path: str, content: bytes, _options: dict[str, str]) -> None:
        self.uploads.append((self._bucket, path, len(content)))


class _FakeWritableSupabaseClient(_FakeSupabaseClient):
    """Adds ``.storage`` and insert-returning tables for the write path."""

    def __init__(self, tables: dict[str, _FakeQuery]) -> None:
        super().__init__(tables)
        self.storage = _FakeStorageBucket()


def session_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "id": SESSION_ID,
        "source": "webcam",
        "status": "completed",
        "media_id": None,
        "started_at": "2026-01-15T12:00:00+00:00",
        "ended_at": "2026-01-15T12:05:00+00:00",
        "duration_seconds": 300.0,
        "total_events": 10,
        "total_alerts": 0,
        "yawn_count": 0,
        "eye_closure_seconds": 0.0,
        "max_fatigue_score": 0.3,
        "final_state": "awake",
        "created_at": "2026-01-15T12:00:00+00:00",
        "updated_at": "2026-01-15T12:05:00+00:00",
    }
    row.update(overrides)
    return row


def override_current_user(app: Any, *, role: AppRole = AppRole.USER) -> None:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=UUID(USER_ID), role=role
    )


class TestListSessionsEndpoint:
    def test_requires_auth(self, make_client):
        with make_client(**JWT_SETTINGS) as client:
            response = client.get("/api/v1/sessions")

        assert response.status_code == 401
        assert response.json()["error_code"] == "AUTH_REQUIRED"

    def test_returns_paginated_sessions(self, make_client):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app)
        fake = _FakeSupabaseClient({"detection_sessions": _FakeQuery([session_row()], count=1)})
        built.app.dependency_overrides[get_supabase_client] = lambda: fake

        with built as client:
            response = client.get("/api/v1/sessions")

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["pagination"]["total_items"] == 1
        assert body["data"]["items"][0]["id"] == SESSION_ID
        assert body["data"]["items"][0]["final_state"] == "AWAKE"


class TestGetSessionEndpoint:
    def test_missing_session_returns_404(self, make_client):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app)
        fake = _FakeSupabaseClient({"detection_sessions": _FakeQuery(None)})
        built.app.dependency_overrides[get_supabase_client] = lambda: fake

        with built as client:
            response = client.get(f"/api/v1/sessions/{SESSION_ID}")

        assert response.status_code == 404
        assert response.json()["error_code"] == "SESSION_NOT_FOUND"

    def test_found_session_returns_detail(self, make_client):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app)
        fake = _FakeSupabaseClient({"detection_sessions": _FakeQuery(session_row())})
        built.app.dependency_overrides[get_supabase_client] = lambda: fake

        with built as client:
            response = client.get(f"/api/v1/sessions/{SESSION_ID}")

        assert response.status_code == 200
        assert response.json()["data"]["id"] == SESSION_ID
        assert response.json()["data"]["max_fatigue_score"] == 30


class TestListSessionEventsEndpoint:
    def test_missing_session_returns_404_without_querying_events(self, make_client):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app)
        fake = _FakeSupabaseClient(
            {
                "detection_sessions": _FakeQuery(None),
                "detection_events": _FakeQuery([{"boom": "should not be reached"}], count=1),
            }
        )
        built.app.dependency_overrides[get_supabase_client] = lambda: fake

        with built as client:
            response = client.get(f"/api/v1/sessions/{SESSION_ID}/events")

        assert response.status_code == 404


def _write_webm(path: Path, *, width: int = 48, height: int = 32, fps: float = 10.0) -> None:
    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run(  # noqa: S603 - fixed argv, no shell, binary from imageio_ffmpeg itself
        [
            ffmpeg,
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"testsrc=size={width}x{height}:rate={fps}:duration=1",
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
def recording_file(tmp_path: Path) -> Path:
    path = tmp_path / "clip.webm"
    _write_webm(path)
    return path


class TestCompleteSessionEndpoint:
    def test_requires_auth(self, make_client, recording_file: Path):
        with make_client(**JWT_SETTINGS) as client, recording_file.open("rb") as fh:
            response = client.post(
                "/api/v1/sessions",
                files={"recording": ("clip.webm", fh, "video/webm")},
                data={"events": "[]", "started_at": NOW},
            )

        assert response.status_code == 401

    def test_malformed_events_returns_validation_error(self, make_client, recording_file: Path):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app)

        with built as client, recording_file.open("rb") as fh:
            response = client.post(
                "/api/v1/sessions",
                files={"recording": ("clip.webm", fh, "video/webm")},
                data={"events": "not json", "started_at": NOW},
            )

        assert response.status_code == 422
        assert response.json()["error_code"] == "VALIDATION_ERROR"

    def test_persists_a_real_session(self, make_client, recording_file: Path):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app)
        fake = _FakeWritableSupabaseClient(
            {
                "detection_sessions": _FakeQuery(None),
                "detection_events": _FakeQuery(None),
                "uploaded_media": _FakeQuery(None),
            }
        )
        built.app.dependency_overrides[get_supabase_client] = lambda: fake

        events = [
            {
                "t": 0.0,
                "ear": 0.8,
                "mar": 0.2,
                "eye_closed": False,
                "yawning": False,
                "state": "AWAKE",
                "alert_level": "SAFE",
                "fatigue_score": 5,
                "detections": [],
            }
        ]

        with built as client, recording_file.open("rb") as fh:
            response = client.post(
                "/api/v1/sessions",
                files={"recording": ("clip.webm", fh, "video/webm")},
                data={"events": json.dumps(events), "started_at": NOW},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["data"]["source"] == "webcam"
        assert payload["data"]["status"] == "completed"
        assert payload["data"]["media"]["bucket"] == "session-clips"

        assert len(fake.storage.uploads) == 1
        bucket, path, size = fake.storage.uploads[0]
        assert bucket == "session-clips"
        assert path.startswith(f"{USER_ID}/")
        assert size > 0
