"""Unit tests for the user repository.

Offline. A fake Supabase client reproduces the ``.table().select().eq().execute()``
chain, so every branch - rows, no rows, unrecognised role, query failure - is
exercised without a network.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

from app.core.constants import AppRole
from app.core.exceptions import DatabaseError
from app.infra.repositories.user_repository import UserRepository

pytestmark = pytest.mark.unit

USER_ID = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")


class _FakeQuery:
    """Records filter calls and returns canned data (or raises) on execute."""

    def __init__(self, rows: list[dict[str, Any]] | None, error: Exception | None) -> None:
        self._rows = rows
        self._error = error
        self.filtered_by: dict[str, str] = {}

    def select(self, *_columns: str) -> _FakeQuery:
        return self

    def eq(self, column: str, value: str) -> _FakeQuery:
        self.filtered_by[column] = value
        return self

    async def execute(self) -> SimpleNamespace:
        if self._error is not None:
            raise self._error
        return SimpleNamespace(data=self._rows)


class _FakeClient:
    """Minimal stand-in exposing ``.table(name)``."""

    def __init__(self, rows: list[dict[str, Any]] | None = None, error: Exception | None = None):
        self.query = _FakeQuery(rows, error)
        self.requested_table: str | None = None

    def table(self, name: str) -> _FakeQuery:
        self.requested_table = name
        return self.query


def make_repo(
    rows: list[dict[str, Any]] | None = None, error: Exception | None = None
) -> tuple[UserRepository, _FakeClient]:
    client = _FakeClient(rows, error)
    return UserRepository(client), client  # type: ignore[arg-type]


class TestGetRoles:
    async def test_returns_assigned_roles(self):
        repo, _ = make_repo([{"role": "admin"}, {"role": "user"}])

        roles = await repo.get_roles(USER_ID)

        assert set(roles) == {AppRole.ADMIN, AppRole.USER}

    async def test_no_rows_is_empty_not_error(self):
        repo, _ = make_repo([])

        assert await repo.get_roles(USER_ID) == []

    async def test_null_data_is_empty(self):
        repo, _ = make_repo(None)

        assert await repo.get_roles(USER_ID) == []

    async def test_queries_the_right_table_scoped_to_the_user(self):
        repo, client = make_repo([{"role": "user"}])

        await repo.get_roles(USER_ID)

        assert client.requested_table == "user_roles"
        assert client.query.filtered_by == {"user_id": str(USER_ID)}

    async def test_unrecognised_role_is_skipped(self):
        """A role string the enum does not know must not crash auth."""
        repo, _ = make_repo([{"role": "user"}, {"role": "superhero"}])

        assert await repo.get_roles(USER_ID) == [AppRole.USER]

    async def test_query_failure_becomes_database_error(self):
        repo, _ = make_repo(error=RuntimeError("postgrest exploded"))

        with pytest.raises(DatabaseError):
            await repo.get_roles(USER_ID)

    async def test_provider_error_detail_is_not_forwarded(self):
        """The SDK's raw message must not leak into the raised error."""
        repo, _ = make_repo(error=RuntimeError("connection string secret leaked"))

        with pytest.raises(DatabaseError) as caught:
            await repo.get_roles(USER_ID)

        assert "secret" not in caught.value.message
