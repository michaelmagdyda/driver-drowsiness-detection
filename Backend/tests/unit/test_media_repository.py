"""Unit tests for the media repository.

Offline. A fake Supabase client reproduces the
``.table().insert()/.select().eq().maybe_single().execute()`` chain, so
scoping and error wrapping are exercised without a network.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

from app.core.exceptions import DatabaseError
from app.infra.repositories.media_repository import MediaRepository

pytestmark = pytest.mark.unit

USER_ID = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
MEDIA_ID = UUID("7c9e6679-7425-40de-944b-e07fc1f90ae7")


class _FakeQuery:
    def __init__(
        self,
        rows: list[dict[str, Any]] | dict[str, Any] | None,
        error: Exception | None,
    ) -> None:
        self._rows = rows
        self._error = error
        self.filtered_by: dict[str, str] = {}
        self.was_maybe_single = False
        self.inserted: dict[str, Any] | None = None

    def select(self, *_columns: str, **_kwargs: Any) -> _FakeQuery:
        return self

    def eq(self, column: str, value: str) -> _FakeQuery:
        self.filtered_by[column] = value
        return self

    def maybe_single(self) -> _FakeQuery:
        self.was_maybe_single = True
        return self

    def insert(self, payload: dict[str, Any]) -> _FakeQuery:
        self.inserted = payload
        return self

    async def execute(self) -> SimpleNamespace:
        if self._error is not None:
            raise self._error
        return SimpleNamespace(data=self._rows)


class _FakeClient:
    def __init__(
        self,
        rows: list[dict[str, Any]] | dict[str, Any] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.query = _FakeQuery(rows, error)
        self.requested_table: str | None = None

    def table(self, name: str) -> _FakeQuery:
        self.requested_table = name
        return self.query


def make_repo(
    rows: list[dict[str, Any]] | dict[str, Any] | None = None, error: Exception | None = None
) -> tuple[MediaRepository, _FakeClient]:
    client = _FakeClient(rows, error)
    return MediaRepository(client), client  # type: ignore[arg-type]


class TestCreateMedia:
    async def test_stamps_user_id_and_returns_inserted_row(self):
        repo, client = make_repo([{"id": str(MEDIA_ID)}])

        row = await repo.create_media(USER_ID, {"bucket": "session-clips"})

        assert row == {"id": str(MEDIA_ID)}
        assert client.requested_table == "uploaded_media"
        assert client.query.inserted == {"bucket": "session-clips", "user_id": str(USER_ID)}

    async def test_caller_cannot_override_user_id(self):
        repo, client = make_repo([{"id": str(MEDIA_ID)}])

        await repo.create_media(USER_ID, {"user_id": "someone-else"})

        assert client.query.inserted["user_id"] == str(USER_ID)

    async def test_empty_response_data_raises_database_error(self):
        repo, _ = make_repo([])

        with pytest.raises(DatabaseError):
            await repo.create_media(USER_ID, {"bucket": "session-clips"})

    async def test_insert_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("boom"))

        with pytest.raises(DatabaseError):
            await repo.create_media(USER_ID, {"bucket": "session-clips"})


class TestGetMedia:
    async def test_returns_row_scoped_to_user(self):
        repo, client = make_repo({"id": str(MEDIA_ID)})

        row = await repo.get_media(USER_ID, MEDIA_ID)

        assert row == {"id": str(MEDIA_ID)}
        assert client.query.filtered_by == {"user_id": str(USER_ID), "id": str(MEDIA_ID)}
        assert client.query.was_maybe_single is True

    async def test_missing_media_returns_none(self):
        repo, _ = make_repo(None)

        assert await repo.get_media(USER_ID, MEDIA_ID) is None

    async def test_query_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("boom"))

        with pytest.raises(DatabaseError):
            await repo.get_media(USER_ID, MEDIA_ID)
