"""Unit tests for the session service.

A fake repository stands in for Supabase, so ownership scoping,
not-found handling and pagination wiring are exercised offline.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import pytest

from app.core.constants import AppRole
from app.core.exceptions import SessionNotFoundError
from app.schemas.auth import AuthenticatedUser
from app.services.session_service import SessionService

pytestmark = pytest.mark.unit

USER_ID = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
SESSION_ID = UUID("7c9e6679-7425-40de-944b-e07fc1f90ae7")
USER = AuthenticatedUser(id=USER_ID, role=AppRole.USER)
NOW = datetime(2026, 1, 15, tzinfo=UTC)


def make_session_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "id": str(SESSION_ID),
        "source": "webcam",
        "status": "completed",
        "media_id": None,
        "started_at": NOW,
        "ended_at": NOW,
        "duration_seconds": 60.0,
        "total_events": 10,
        "total_alerts": 0,
        "yawn_count": 0,
        "eye_closure_seconds": 0.0,
        "max_fatigue_score": None,
        "final_state": None,
        "created_at": NOW,
        "updated_at": NOW,
    }
    row.update(overrides)
    return row


class _FakeRepository:
    def __init__(
        self,
        sessions: list[dict[str, Any]] | None = None,
        session: dict[str, Any] | None = None,
        events: list[dict[str, Any]] | None = None,
        total: int = 0,
    ) -> None:
        self._sessions = sessions or []
        self._session = session
        self._events = events or []
        self._total = total
        self.get_session_calls: list[tuple[UUID, UUID]] = []
        self.list_events_calls: list[tuple[UUID, UUID]] = []

    async def list_sessions(
        self, user_id: UUID, *, page: int, page_size: int  # noqa: ARG002
    ) -> tuple[list[dict[str, Any]], int]:
        return self._sessions, self._total

    async def get_session(self, user_id: UUID, session_id: UUID) -> dict[str, Any] | None:
        self.get_session_calls.append((user_id, session_id))
        return self._session

    async def list_events(
        self, user_id: UUID, session_id: UUID, *, page: int, page_size: int  # noqa: ARG002
    ) -> tuple[list[dict[str, Any]], int]:
        self.list_events_calls.append((user_id, session_id))
        return self._events, self._total


class TestListSessions:
    async def test_wraps_rows_with_pagination(self):
        repo = _FakeRepository(sessions=[make_session_row()], total=1)
        service = SessionService(repo)  # type: ignore[arg-type]

        result = await service.list_sessions(USER, page=1, page_size=20)

        assert len(result.items) == 1
        assert result.pagination.total_items == 1
        assert result.pagination.page == 1


class _FakeMediaRepository:
    def __init__(self, media: dict[str, Any] | None = None) -> None:
        self._media = media
        self.get_media_calls: list[tuple[UUID, UUID]] = []

    async def get_media(self, user_id: UUID, media_id: UUID) -> dict[str, Any] | None:
        self.get_media_calls.append((user_id, media_id))
        return self._media


MEDIA_ID = UUID("11111111-1111-1111-1111-111111111111")


class TestGetSession:
    async def test_returns_detail_when_found(self):
        repo = _FakeRepository(session=make_session_row())
        service = SessionService(repo)  # type: ignore[arg-type]

        detail = await service.get_session(USER, SESSION_ID)

        assert detail.id == SESSION_ID
        assert repo.get_session_calls == [(USER_ID, SESSION_ID)]

    async def test_missing_session_raises_not_found(self):
        repo = _FakeRepository(session=None)
        service = SessionService(repo)  # type: ignore[arg-type]

        with pytest.raises(SessionNotFoundError):
            await service.get_session(USER, SESSION_ID)

    async def test_resolves_linked_media_when_present(self):
        repo = _FakeRepository(session=make_session_row(media_id=str(MEDIA_ID)))
        media_repo = _FakeMediaRepository(
            media={"bucket": "session-clips", "storage_path": "p.mp4", "mime_type": "video/mp4"}
        )
        service = SessionService(repo, media_repo)  # type: ignore[arg-type]

        detail = await service.get_session(USER, SESSION_ID)

        assert detail.media is not None
        assert detail.media.bucket == "session-clips"
        assert media_repo.get_media_calls == [(USER_ID, MEDIA_ID)]

    async def test_no_media_repository_degrades_to_none(self):
        repo = _FakeRepository(session=make_session_row(media_id=str(MEDIA_ID)))
        service = SessionService(repo)  # type: ignore[arg-type]

        detail = await service.get_session(USER, SESSION_ID)

        assert detail.media is None

    async def test_session_without_media_id_skips_lookup(self):
        repo = _FakeRepository(session=make_session_row(media_id=None))
        media_repo = _FakeMediaRepository(media={"bucket": "x"})
        service = SessionService(repo, media_repo)  # type: ignore[arg-type]

        detail = await service.get_session(USER, SESSION_ID)

        assert detail.media is None
        assert media_repo.get_media_calls == []


class TestListEvents:
    async def test_confirms_ownership_before_listing(self):
        event_row = {"id": 1, "ts": NOW, "state": "awake", "alert_level": "none"}
        repo = _FakeRepository(session=make_session_row(), events=[event_row], total=1)
        service = SessionService(repo)  # type: ignore[arg-type]

        result = await service.list_events(USER, SESSION_ID, page=1, page_size=100)

        assert repo.get_session_calls == [(USER_ID, SESSION_ID)]
        assert repo.list_events_calls == [(USER_ID, SESSION_ID)]
        assert result.pagination.total_items == 1

    async def test_other_users_session_is_not_found_not_forbidden(self):
        """A session id belonging to another user must 404, never leak a 403."""
        repo = _FakeRepository(session=None)
        service = SessionService(repo)  # type: ignore[arg-type]

        with pytest.raises(SessionNotFoundError):
            await service.list_events(USER, SESSION_ID, page=1, page_size=100)

        assert repo.list_events_calls == [], "events must not be queried once ownership fails"
