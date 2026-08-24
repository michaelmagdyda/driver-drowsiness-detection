"""Unit tests for the auth dependency providers.

Exercises ``get_current_user``, ``get_optional_user`` and ``require_admin``
end-to-end against real ES256-signed tokens (via ``tests/unit/keys.py``), with
fake JWKS/auth-service collaborators standing in for the network and database.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

import pytest

from app.core.config import Settings
from app.core.constants import AppRole
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    InvalidTokenError,
    ServiceUnavailableError,
)
from app.dependencies.auth import get_current_user, get_optional_user, require_admin
from app.schemas.auth import AuthenticatedUser
from app.services.auth_service import AuthService
from app.services.role_cache import RoleCache
from tests.unit.keys import USER_ID, SigningKey

if TYPE_CHECKING:
    from jwt import PyJWK

pytestmark = pytest.mark.unit

KEY = SigningKey(kid="test-key-1")


class _FakeJWKSProvider:
    """Returns one fixed key for its own ``kid``, rejects everything else."""

    def __init__(self, key: SigningKey | None) -> None:
        self._key = key

    async def get_signing_key(self, kid: str) -> PyJWK:
        if self._key is None or kid != self._key.kid:
            msg = "unknown key"
            raise InvalidTokenError(msg)
        return self._key.public_jwk()


class _FakeUserRepository:
    """Returns a fixed role set, ignoring which user is asked about."""

    def __init__(self, roles: list[AppRole]) -> None:
        self._roles = roles

    async def get_roles(self, user_id: UUID) -> list[AppRole]:  # noqa: ARG002
        return self._roles


def make_settings(**overrides: Any) -> Settings:
    """Build hermetic settings with JWT verification pointed at the test issuer."""
    base: dict[str, Any] = {
        "_env_file": None,
        "secret_key": "test-only-secret-key-0123456789abcdefghijklmnop",
        "allowed_origins": ["http://testserver"],
        "supabase_url": "https://testref.supabase.co",
    }
    base.update(overrides)
    return Settings(**base)


def make_auth_service(roles: list[AppRole] | None = None) -> AuthService:
    """Build a real AuthService over a fake repository returning fixed roles."""
    return AuthService(_FakeUserRepository(roles or []), RoleCache(ttl_seconds=60))


class TestGetCurrentUser:
    async def test_valid_token_returns_authenticated_user(self):
        token = KEY.sign()

        user = await get_current_user(
            settings=make_settings(),
            jwks_provider=_FakeJWKSProvider(KEY),
            auth_service=make_auth_service([AppRole.USER]),
            authorization=f"Bearer {token}",
        )

        assert isinstance(user, AuthenticatedUser)
        assert str(user.id) == USER_ID
        assert user.role is AppRole.USER

    async def test_admin_role_resolved_from_database_not_token(self):
        """The token never carries an app role; the database does."""
        token = KEY.sign()

        user = await get_current_user(
            settings=make_settings(),
            jwks_provider=_FakeJWKSProvider(KEY),
            auth_service=make_auth_service([AppRole.ADMIN]),
            authorization=f"Bearer {token}",
        )

        assert user.is_admin is True

    async def test_missing_header_raises_authentication_error(self):
        with pytest.raises(AuthenticationError):
            await get_current_user(
                settings=make_settings(),
                jwks_provider=_FakeJWKSProvider(KEY),
                auth_service=make_auth_service(),
                authorization=None,
            )

    async def test_malformed_token_raises_invalid_token_error(self):
        with pytest.raises(InvalidTokenError):
            await get_current_user(
                settings=make_settings(),
                jwks_provider=_FakeJWKSProvider(KEY),
                auth_service=make_auth_service(),
                authorization="Bearer not-a-real-token",
            )

    async def test_wrong_issuer_is_rejected(self):
        """A token from a different Supabase project must not verify."""
        token = KEY.sign(iss="https://a-different-project.supabase.co/auth/v1")

        with pytest.raises(InvalidTokenError):
            await get_current_user(
                settings=make_settings(),
                jwks_provider=_FakeJWKSProvider(KEY),
                auth_service=make_auth_service(),
                authorization=f"Bearer {token}",
            )

    async def test_unconfigured_verification_raises_service_unavailable(self):
        with pytest.raises(ServiceUnavailableError):
            await get_current_user(
                settings=make_settings(supabase_url=None),
                jwks_provider=_FakeJWKSProvider(KEY),
                auth_service=make_auth_service(),
                authorization="Bearer whatever",
            )


class TestGetOptionalUser:
    async def test_no_header_returns_none(self):
        result = await get_optional_user(
            settings=make_settings(),
            jwks_provider=_FakeJWKSProvider(KEY),
            auth_service=make_auth_service(),
            authorization=None,
        )

        assert result is None

    async def test_valid_header_returns_user(self):
        token = KEY.sign()

        result = await get_optional_user(
            settings=make_settings(),
            jwks_provider=_FakeJWKSProvider(KEY),
            auth_service=make_auth_service([AppRole.USER]),
            authorization=f"Bearer {token}",
        )

        assert result is not None
        assert result.role is AppRole.USER

    async def test_invalid_header_still_raises(self):
        """An absent token is tolerated; a present-but-bad one is not."""
        with pytest.raises(InvalidTokenError):
            await get_optional_user(
                settings=make_settings(),
                jwks_provider=_FakeJWKSProvider(KEY),
                auth_service=make_auth_service(),
                authorization="Bearer garbage",
            )


class TestRequireAdmin:
    def test_admin_passes(self):
        admin = AuthenticatedUser(id=UUID(USER_ID), role=AppRole.ADMIN)

        assert require_admin(admin) is admin

    def test_non_admin_raises(self):
        user = AuthenticatedUser(id=UUID(USER_ID), role=AppRole.USER)

        with pytest.raises(AuthorizationError):
            require_admin(user)
