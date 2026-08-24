"""Unit tests for the auth service.

A fake repository (recording call counts) and a real :class:`RoleCache` verify
role priority, caching behaviour, the default, and principal assembly - all
offline.
"""

from __future__ import annotations

from uuid import UUID

import pytest

from app.core.constants import AppRole
from app.core.exceptions import DatabaseError
from app.schemas.auth import AuthenticatedUser, TokenClaims
from app.services.auth_service import AuthService
from app.services.role_cache import RoleCache

pytestmark = pytest.mark.unit

USER_ID = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")


class _FakeRepository:
    """Returns a fixed role set and counts lookups."""

    def __init__(self, roles: list[AppRole] | None = None, error: Exception | None = None):
        self._roles = roles or []
        self._error = error
        self.calls = 0

    async def get_roles(self, user_id: UUID) -> list[AppRole]:  # noqa: ARG002
        self.calls += 1
        if self._error is not None:
            raise self._error
        return self._roles


def make_service(
    roles: list[AppRole] | None = None,
    *,
    ttl: int = 60,
    error: Exception | None = None,
) -> tuple[AuthService, _FakeRepository]:
    repo = _FakeRepository(roles, error)
    return AuthService(repo, RoleCache(ttl_seconds=ttl)), repo  # type: ignore[arg-type]


def make_claims(user_id: UUID = USER_ID, email: str | None = "driver@example.com") -> TokenClaims:
    return TokenClaims.model_validate(
        {
            "sub": str(user_id),
            "email": email,
            "aud": "authenticated",
            "iss": "https://ref.supabase.co/auth/v1",
            "iat": 1_700_000_000,
            "exp": 1_700_003_600,
            "role": "authenticated",
        }
    )


class TestRolePriority:
    async def test_admin_row_wins(self):
        service, _ = make_service([AppRole.USER, AppRole.ADMIN])

        assert await service.resolve_role(USER_ID) is AppRole.ADMIN

    async def test_user_only(self):
        service, _ = make_service([AppRole.USER])

        assert await service.resolve_role(USER_ID) is AppRole.USER

    async def test_no_rows_defaults_to_user(self):
        """A user with no role rows is the least-privileged default."""
        service, _ = make_service([])

        assert await service.resolve_role(USER_ID) is AppRole.USER


class TestCaching:
    async def test_second_call_is_cached(self):
        service, repo = make_service([AppRole.ADMIN])

        await service.resolve_role(USER_ID)
        await service.resolve_role(USER_ID)

        assert repo.calls == 1, "second resolution should hit the cache"

    async def test_disabled_cache_always_queries(self):
        service, repo = make_service([AppRole.ADMIN], ttl=0)

        await service.resolve_role(USER_ID)
        await service.resolve_role(USER_ID)

        assert repo.calls == 2


class TestAuthenticate:
    async def test_builds_authenticated_user(self):
        service, _ = make_service([AppRole.ADMIN])

        user = await service.authenticate(make_claims())

        assert isinstance(user, AuthenticatedUser)
        assert user.id == USER_ID
        assert user.email == "driver@example.com"
        assert user.role is AppRole.ADMIN
        assert user.is_admin is True

    async def test_default_user_is_not_admin(self):
        service, _ = make_service([])

        user = await service.authenticate(make_claims())

        assert user.role is AppRole.USER
        assert user.is_admin is False

    async def test_role_never_comes_from_the_token(self):
        """A forged `role: admin` claim must not make an admin.

        The claims carry role='authenticated' (postgres role); the repository
        returns no app roles, so the principal is a plain user regardless of
        anything in the token.
        """
        service, _ = make_service([])  # no admin row in the database

        user = await service.authenticate(make_claims())

        assert user.is_admin is False


class TestFailureClosed:
    async def test_database_error_propagates(self):
        """Auth fails closed: a lookup failure is raised, not defaulted."""
        service, _ = make_service(error=DatabaseError("db down"))

        with pytest.raises(DatabaseError):
            await service.resolve_role(USER_ID)
