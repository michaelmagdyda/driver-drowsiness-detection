"""Unit tests for the admin service.

A fake repository stands in for the GoTrue admin API and the
``user_roles``/``profiles`` tables, so the join and role-priority logic is
exercised offline.
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest

from app.services.admin_service import AdminService

pytestmark = pytest.mark.unit

NOW = datetime(2026, 1, 1, tzinfo=UTC)

U1 = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
U2 = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
U3 = "11111111-1111-1111-1111-111111111111"


def make_user(user_id: str, email: str | None = "driver@example.com") -> SimpleNamespace:
    return SimpleNamespace(id=user_id, email=email, created_at=NOW, last_sign_in_at=NOW)


class _FakeRepository:
    def __init__(
        self,
        users: list[Any],
        roles: list[dict[str, Any]],
        profiles: list[dict[str, Any]],
    ) -> None:
        self._users = users
        self._roles = roles
        self._profiles = profiles

    async def list_auth_users(
        self, *, page: int | None = None, per_page: int | None = None  # noqa: ARG002
    ) -> list[Any]:
        return self._users

    async def list_all_roles(self) -> list[dict[str, Any]]:
        return self._roles

    async def list_all_profiles(self) -> list[dict[str, Any]]:
        return self._profiles


class TestListUsers:
    async def test_joins_role_and_display_name(self):
        repo = _FakeRepository(
            users=[make_user(U1)],
            roles=[{"user_id": U1, "role": "admin"}],
            profiles=[{"id": U1, "display_name": "Driver One"}],
        )
        service = AdminService(repo)  # type: ignore[arg-type]

        users = await service.list_users()

        assert len(users) == 1
        assert users[0].role == "admin"
        assert users[0].display_name == "Driver One"
        assert users[0].email == "driver@example.com"

    async def test_defaults_to_user_role_with_no_role_row(self):
        repo = _FakeRepository(users=[make_user(U2)], roles=[], profiles=[])
        service = AdminService(repo)  # type: ignore[arg-type]

        users = await service.list_users()

        assert users[0].role == "user"

    async def test_missing_profile_leaves_display_name_none(self):
        repo = _FakeRepository(users=[make_user(U3)], roles=[], profiles=[])
        service = AdminService(repo)  # type: ignore[arg-type]

        users = await service.list_users()

        assert users[0].display_name is None

    async def test_does_not_confuse_users_roles(self):
        """u1's admin row must not leak onto u2."""
        repo = _FakeRepository(
            users=[make_user(U1), make_user(U2)],
            roles=[{"user_id": U1, "role": "admin"}],
            profiles=[],
        )
        service = AdminService(repo)  # type: ignore[arg-type]

        users = await service.list_users()

        roles = {str(u.id): u.role for u in users}
        assert roles[U1] == "admin"
        assert roles[U2] == "user"
