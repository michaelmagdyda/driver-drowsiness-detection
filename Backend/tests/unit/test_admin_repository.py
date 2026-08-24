"""Unit tests for the admin repository.

Offline. A fake Supabase client stands in for both the PostgREST tables
(``user_roles``, ``profiles``) and the GoTrue admin API (``auth.admin``).
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.core.exceptions import DatabaseError
from app.infra.repositories.admin_repository import AdminRepository

pytestmark = pytest.mark.unit


class _FakeQuery:
    def __init__(self, rows: list[dict[str, Any]] | None, error: Exception | None) -> None:
        self._rows = rows
        self._error = error

    def select(self, *_columns: str) -> _FakeQuery:
        return self

    async def execute(self) -> SimpleNamespace:
        if self._error is not None:
            raise self._error
        return SimpleNamespace(data=self._rows)


class _FakeAdminAPI:
    def __init__(self, users: list[Any] | None, error: Exception | None) -> None:
        self._users = users
        self._error = error
        self.last_call: tuple[int | None, int | None] | None = None

    async def list_users(self, page: int | None = None, per_page: int | None = None) -> list[Any]:
        self.last_call = (page, per_page)
        if self._error is not None:
            raise self._error
        return self._users or []


class _FakeAuth:
    def __init__(self, admin_api: _FakeAdminAPI) -> None:
        self.admin = admin_api


class _FakeClient:
    def __init__(
        self,
        *,
        users: list[Any] | None = None,
        users_error: Exception | None = None,
        roles: list[dict[str, Any]] | None = None,
        roles_error: Exception | None = None,
        profiles: list[dict[str, Any]] | None = None,
        profiles_error: Exception | None = None,
    ) -> None:
        self.auth = _FakeAuth(_FakeAdminAPI(users, users_error))
        self._tables = {
            "user_roles": _FakeQuery(roles, roles_error),
            "profiles": _FakeQuery(profiles, profiles_error),
        }
        self.requested_tables: list[str] = []

    def table(self, name: str) -> _FakeQuery:
        self.requested_tables.append(name)
        return self._tables[name]


class TestListAuthUsers:
    async def test_returns_users_and_forwards_pagination(self):
        client = _FakeClient(users=[SimpleNamespace(id="u1")])
        repo = AdminRepository(client)  # type: ignore[arg-type]

        users = await repo.list_auth_users(page=2, per_page=50)

        assert [u.id for u in users] == ["u1"]
        assert client.auth.admin.last_call == (2, 50)

    async def test_failure_becomes_database_error(self):
        client = _FakeClient(users_error=RuntimeError("gotrue down"))
        repo = AdminRepository(client)  # type: ignore[arg-type]

        with pytest.raises(DatabaseError):
            await repo.list_auth_users()


class TestListAllRoles:
    async def test_returns_rows(self):
        client = _FakeClient(roles=[{"user_id": "u1", "role": "admin"}])
        repo = AdminRepository(client)  # type: ignore[arg-type]

        rows = await repo.list_all_roles()

        assert rows == [{"user_id": "u1", "role": "admin"}]
        assert "user_roles" in client.requested_tables

    async def test_null_data_is_empty(self):
        client = _FakeClient(roles=None)
        repo = AdminRepository(client)  # type: ignore[arg-type]

        assert await repo.list_all_roles() == []

    async def test_failure_becomes_database_error(self):
        client = _FakeClient(roles_error=RuntimeError("boom"))
        repo = AdminRepository(client)  # type: ignore[arg-type]

        with pytest.raises(DatabaseError):
            await repo.list_all_roles()


class TestListAllProfiles:
    async def test_returns_rows(self):
        client = _FakeClient(profiles=[{"id": "u1", "display_name": "Driver One"}])
        repo = AdminRepository(client)  # type: ignore[arg-type]

        rows = await repo.list_all_profiles()

        assert rows == [{"id": "u1", "display_name": "Driver One"}]
        assert "profiles" in client.requested_tables

    async def test_failure_becomes_database_error(self):
        client = _FakeClient(profiles_error=RuntimeError("boom"))
        repo = AdminRepository(client)  # type: ignore[arg-type]

        with pytest.raises(DatabaseError):
            await repo.list_all_profiles()
