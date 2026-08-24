"""Authentication and authorisation dependency providers (Phase E5).

Wires the already-verified building blocks - :mod:`app.core.security`,
:class:`~app.infra.jwks.JWKSProvider`, :class:`~app.services.auth_service.AuthService`
- onto the request path. Each provider follows the same shape as
:func:`app.dependencies.database.get_supabase_client`: read a singleton the
lifespan hook placed on ``app.state``, raise a specific error if it is absent,
never return ``None``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, Header, Request

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthorizationError, ServiceUnavailableError
from app.core.security import extract_bearer_token, verify_access_token
from app.schemas.auth import AuthenticatedUser

if TYPE_CHECKING:
    from app.infra.jwks import JWKSProvider
    from app.services.auth_service import AuthService

# Attribute names under which the lifespan hook stores these on app.state.
AUTH_SERVICE_STATE_ATTR = "auth_service"
JWKS_PROVIDER_STATE_ATTR = "jwks_provider"

SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_auth_service(request: Request) -> AuthService:
    """Return the shared authentication service.

    Args:
        request: The incoming request, used only to reach ``app.state``.

    Returns:
        The process-wide :class:`AuthService`.

    Raises:
        ServiceUnavailableError: Supabase was not configured at startup, so no
            service exists.
    """
    service: AuthService | None = getattr(request.app.state, AUTH_SERVICE_STATE_ATTR, None)
    if service is None:
        raise ServiceUnavailableError("Authentication is not currently available.")
    return service


def get_jwks_provider(request: Request) -> JWKSProvider:
    """Return the shared JWKS provider.

    Args:
        request: The incoming request, used only to reach ``app.state``.

    Returns:
        The process-wide :class:`JWKSProvider`.

    Raises:
        ServiceUnavailableError: Token verification was not configured at
            startup (``SUPABASE_URL`` unset), so no provider exists.
    """
    provider: JWKSProvider | None = getattr(request.app.state, JWKS_PROVIDER_STATE_ATTR, None)
    if provider is None:
        raise ServiceUnavailableError("Authentication is not currently available.")
    return provider


AuthServiceDep = Annotated["AuthService", Depends(get_auth_service)]
JWKSProviderDep = Annotated["JWKSProvider", Depends(get_jwks_provider)]


async def _authenticate(
    authorization: str | None,
    *,
    settings: Settings,
    jwks_provider: JWKSProvider,
    auth_service: AuthService,
) -> AuthenticatedUser:
    """Shared verification path for the required and optional user dependencies.

    Args:
        authorization: Raw ``Authorization`` header value, or ``None``.
        settings: Application settings, for the expected audience/issuer.
        jwks_provider: Resolves the signing key for the token's ``kid``.
        auth_service: Resolves the application role and builds the principal.

    Returns:
        The authenticated principal.

    Raises:
        AuthenticationError: No credentials were supplied.
        InvalidTokenError: The token is malformed, forged, or expired.
        ServiceUnavailableError: Verification is not configured, or the
            signing keys could not be obtained.
    """
    if not settings.is_jwt_verification_configured or settings.supabase_issuer is None:
        raise ServiceUnavailableError("Authentication is not currently available.")

    token = extract_bearer_token(authorization)
    claims = await verify_access_token(
        token,
        key_provider=jwks_provider,
        audience=settings.jwt_audience,
        issuer=settings.supabase_issuer,
        leeway_seconds=settings.jwt_leeway_seconds,
    )
    return await auth_service.authenticate(claims)


async def get_current_user(
    settings: SettingsDep,
    jwks_provider: JWKSProviderDep,
    auth_service: AuthServiceDep,
    authorization: Annotated[str | None, Header()] = None,
) -> AuthenticatedUser:
    """Verify the Supabase access token on the ``Authorization`` header.

    Args:
        settings: Application settings.
        jwks_provider: Injected JWKS provider.
        auth_service: Injected authentication service.
        authorization: Raw ``Authorization`` header, read by FastAPI.

    Returns:
        The authenticated principal.

    Raises:
        AuthenticationError: No credentials were supplied.
        InvalidTokenError: The token is malformed, forged, or expired.
        ServiceUnavailableError: Verification is not configured or unreachable.
    """
    return await _authenticate(
        authorization,
        settings=settings,
        jwks_provider=jwks_provider,
        auth_service=auth_service,
    )


async def get_optional_user(
    settings: SettingsDep,
    jwks_provider: JWKSProviderDep,
    auth_service: AuthServiceDep,
    authorization: Annotated[str | None, Header()] = None,
) -> AuthenticatedUser | None:
    """As :func:`get_current_user`, but tolerates an absent token.

    Args:
        settings: Application settings.
        jwks_provider: Injected JWKS provider.
        auth_service: Injected authentication service.
        authorization: Raw ``Authorization`` header, read by FastAPI.

    Returns:
        The authenticated principal, or ``None`` when no credentials were sent.

    Raises:
        InvalidTokenError: Credentials were supplied but are invalid.
        ServiceUnavailableError: Verification is not configured or unreachable.
    """
    if not authorization:
        return None
    return await _authenticate(
        authorization,
        settings=settings,
        jwks_provider=jwks_provider,
        auth_service=auth_service,
    )


CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]
OptionalUserDep = Annotated["AuthenticatedUser | None", Depends(get_optional_user)]


def require_admin(user: CurrentUserDep) -> AuthenticatedUser:
    """Assert the ``admin`` role.

    The sole enforcement point for administrator access - the frontend's
    ``/admin`` route has no role gate of its own, only the authenticated check.

    Args:
        user: The authenticated principal, resolved first.

    Returns:
        The same principal, once confirmed to hold the admin role.

    Raises:
        AuthorizationError: The caller is authenticated but not an admin.
    """
    if not user.is_admin:
        raise AuthorizationError("Administrator role required.")
    return user


AdminUserDep = Annotated[AuthenticatedUser, Depends(require_admin)]
