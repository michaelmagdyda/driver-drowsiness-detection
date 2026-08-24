"""Unit tests for the session repository.

Offline. A fake Supabase client reproduces the
``.table().select().eq().order().range().execute()`` chain, so pagination,
scoping and error wrapping are exercised without a network.
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

from app.core.exceptions import DatabaseError
from app.infra.repositories.session_repository import SessionRepository

pytestmark = pytest.mark.unit

USER_ID = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
SESSION_ID = UUID("7c9e6679-7425-40de-944b-e07fc1f90ae7")


class _FakeQuery:
    """Records every chained call and returns canned data (or raises) on execute."""

    def __init__(
        self,
        rows: list[dict[str, Any]] | dict[str, Any] | None,
        error: Exception | None,
        count: int | None = None,
    ) -> None:
        self._rows = rows
        self._error = error
        self._count = count
        self.filtered_by: dict[str, str] = {}
        self.ordered_by: tuple[str, bool] | None = None
        self.ranged: tuple[int, int] | None = None
        self.was_maybe_single = False
        self.inserted: dict[str, Any] | list[dict[str, Any]] | None = None

    def select(self, *_columns: str, **_kwargs: Any) -> _FakeQuery:
        return self

    def eq(self, column: str, value: str) -> _FakeQuery:
        self.filtered_by[column] = value
        return self

    def gte(self, column: str, value: str) -> _FakeQuery:
        self.filtered_by[f"{column}__gte"] = value
        return self

    def lt(self, column: str, value: str) -> _FakeQuery:
        self.filtered_by[f"{column}__lt"] = value
        return self

    def order(self, column: str, *, desc: bool = False) -> _FakeQuery:
        self.ordered_by = (column, desc)
        return self

    def range(self, start: int, end: int) -> _FakeQuery:
        self.ranged = (start, end)
        return self

    def maybe_single(self) -> _FakeQuery:
        self.was_maybe_single = True
        return self

    def insert(self, payload: dict[str, Any] | list[dict[str, Any]]) -> _FakeQuery:
        self.inserted = payload
        return self

    async def execute(self) -> SimpleNamespace:
        if self._error is not None:
            raise self._error
        return SimpleNamespace(data=self._rows, count=self._count)


class _FakeClient:
    """Minimal stand-in exposing ``.table(name)``."""

    def __init__(
        self,
        rows: list[dict[str, Any]] | dict[str, Any] | None = None,
        error: Exception | None = None,
        count: int | None = None,
    ) -> None:
        self.query = _FakeQuery(rows, error, count)
        self.requested_table: str | None = None

    def table(self, name: str) -> _FakeQuery:
        self.requested_table = name
        return self.query


def make_repo(
    rows: list[dict[str, Any]] | dict[str, Any] | None = None,
    error: Exception | None = None,
    count: int | None = None,
) -> tuple[SessionRepository, _FakeClient]:
    client = _FakeClient(rows, error, count)
    return SessionRepository(client), client  # type: ignore[arg-type]


class TestListSessions:
    async def test_returns_rows_and_count(self):
        repo, client = make_repo([{"id": "s1"}], count=1)

        rows, total = await repo.list_sessions(USER_ID, page=1, page_size=20)

        assert rows == [{"id": "s1"}]
        assert total == 1
        assert client.requested_table == "detection_sessions"
        assert client.query.filtered_by == {"user_id": str(USER_ID)}
        assert client.query.ordered_by == ("started_at", True)

    async def test_pagination_computes_range(self):
        repo, client = make_repo([], count=0)

        await repo.list_sessions(USER_ID, page=3, page_size=10)

        assert client.query.ranged == (20, 29)

    async def test_null_data_is_empty(self):
        repo, _ = make_repo(None, count=None)

        rows, total = await repo.list_sessions(USER_ID, page=1, page_size=20)

        assert rows == []
        assert total == 0

    async def test_query_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("postgrest exploded"))

        with pytest.raises(DatabaseError):
            await repo.list_sessions(USER_ID, page=1, page_size=20)


class TestGetSession:
    async def test_returns_row_scoped_to_user(self):
        repo, client = make_repo({"id": str(SESSION_ID)})

        row = await repo.get_session(USER_ID, SESSION_ID)

        assert row == {"id": str(SESSION_ID)}
        assert client.query.filtered_by == {"user_id": str(USER_ID), "id": str(SESSION_ID)}
        assert client.query.was_maybe_single is True

    async def test_missing_session_returns_none(self):
        repo, _ = make_repo(None)

        assert await repo.get_session(USER_ID, SESSION_ID) is None

    async def test_query_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("boom"))

        with pytest.raises(DatabaseError):
            await repo.get_session(USER_ID, SESSION_ID)


class TestListEvents:
    async def test_scopes_to_user_and_session(self):
        repo, client = make_repo([{"id": 1}], count=1)

        rows, total = await repo.list_events(USER_ID, SESSION_ID, page=1, page_size=100)

        assert rows == [{"id": 1}]
        assert total == 1
        assert client.requested_table == "detection_events"
        assert client.query.filtered_by == {
            "user_id": str(USER_ID),
            "session_id": str(SESSION_ID),
        }
        assert client.query.ordered_by == ("ts", False)

    async def test_query_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("boom"))

        with pytest.raises(DatabaseError):
            await repo.list_events(USER_ID, SESSION_ID, page=1, page_size=100)


class TestCreateSession:
    async def test_stamps_user_id_and_returns_inserted_row(self):
        repo, client = make_repo([{"id": str(SESSION_ID), "user_id": str(USER_ID)}])

        row = await repo.create_session(USER_ID, {"source": "webcam", "status": "completed"})

        assert row == {"id": str(SESSION_ID), "user_id": str(USER_ID)}
        assert client.requested_table == "detection_sessions"
        assert client.query.inserted == {
            "source": "webcam",
            "status": "completed",
            "user_id": str(USER_ID),
        }

    async def test_caller_cannot_override_user_id(self):
        repo, client = make_repo([{"id": str(SESSION_ID)}])

        await repo.create_session(USER_ID, {"user_id": "someone-else"})

        assert client.query.inserted["user_id"] == str(USER_ID)

    async def test_empty_response_data_raises_database_error(self):
        repo, _ = make_repo([])

        with pytest.raises(DatabaseError):
            await repo.create_session(USER_ID, {"source": "webcam"})

    async def test_insert_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("boom"))

        with pytest.raises(DatabaseError):
            await repo.create_session(USER_ID, {"source": "webcam"})


class TestInsertEvents:
    async def test_stamps_user_and_session_id_on_every_row(self):
        repo, client = make_repo([{"id": 1}])

        await repo.insert_events(USER_ID, SESSION_ID, [{"ts": "t1"}, {"ts": "t2"}])

        assert client.requested_table == "detection_events"
        assert client.query.inserted == [
            {"ts": "t1", "user_id": str(USER_ID), "session_id": str(SESSION_ID)},
            {"ts": "t2", "user_id": str(USER_ID), "session_id": str(SESSION_ID)},
        ]

    async def test_empty_list_is_a_no_op(self):
        repo, client = make_repo()

        await repo.insert_events(USER_ID, SESSION_ID, [])

        assert client.requested_table is None, "must not query at all for an empty batch"

    async def test_insert_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("boom"))

        with pytest.raises(DatabaseError):
            await repo.insert_events(USER_ID, SESSION_ID, [{"ts": "t1"}])


class TestListRecentSessions:
    async def test_filters_by_cutoff(self):
        since = datetime(2026, 1, 1, tzinfo=UTC)
        repo, client = make_repo([{"started_at": "2026-01-15T00:00:00Z"}])

        rows = await repo.list_recent_sessions(USER_ID, since=since)

        assert rows == [{"started_at": "2026-01-15T00:00:00Z"}]
        assert client.query.filtered_by["user_id"] == str(USER_ID)
        assert client.query.filtered_by["started_at__gte"] == since.isoformat()
        assert "started_at__lt" not in client.query.filtered_by

    async def test_until_adds_upper_bound(self):
        since = datetime(2026, 1, 1, tzinfo=UTC)
        until = datetime(2026, 1, 8, tzinfo=UTC)
        repo, client = make_repo([])

        await repo.list_recent_sessions(USER_ID, since=since, until=until)

        assert client.query.filtered_by["started_at__gte"] == since.isoformat()
        assert client.query.filtered_by["started_at__lt"] == until.isoformat()

    async def test_query_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("boom"))

        with pytest.raises(DatabaseError):
            await repo.list_recent_sessions(USER_ID, since=datetime(2026, 1, 1, tzinfo=UTC))


class TestListRecentEvents:
    async def test_filters_by_cutoff(self):
        since = datetime(2026, 1, 1, tzinfo=UTC)
        repo, client = make_repo([{"ts": "2026-01-15T00:00:00Z"}])

        rows = await repo.list_recent_events(USER_ID, since=since)

        assert rows == [{"ts": "2026-01-15T00:00:00Z"}]
        assert client.query.filtered_by["user_id"] == str(USER_ID)
        assert client.query.filtered_by["ts__gte"] == since.isoformat()

    async def test_until_adds_upper_bound(self):
        since = datetime(2026, 1, 1, tzinfo=UTC)
        until = datetime(2026, 1, 8, tzinfo=UTC)
        repo, client = make_repo([])

        await repo.list_recent_events(USER_ID, since=since, until=until)

        assert client.query.filtered_by["ts__lt"] == until.isoformat()

    async def test_query_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("boom"))

        with pytest.raises(DatabaseError):
            await repo.list_recent_events(USER_ID, since=datetime(2026, 1, 1, tzinfo=UTC))
