"""Admin repository - reads user identity and role data for the admin console.

Unlike :class:`~app.infra.repositories.user_repository.UserRepository`, this
repository deliberately reads *across* users - it is the one place in the
codebase allowed to, and every caller must be gated behind
:func:`app.dependencies.auth.require_admin` before reaching it.

User email/creation/last-sign-in data lives in Supabase Auth (``auth.users``),
which PostgREST does not expose as a queryable table - it is reached instead
through the GoTrue admin API (``client.auth.admin``), available because the
backend authenticates with the service-role key.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.core.exceptions import DatabaseError
from app.core.logging import get_logger

if TYPE_CHECKING:
    from supabase import AsyncClient
    from supabase_auth.types import User

logger = get_logger(__name__)

ROLES_TABLE = "user_roles"
PROFILES_TABLE = "profiles"


class AdminRepository:
    """Reads cross-user identity, role and profile data from Supabase.

    Constructed with an :class:`AsyncClient` (dependency injection). Stateless
    beyond the injected client - safe to create per request.
    """

    def __init__(self, client: AsyncClient) -> None:
        """Store the injected Supabase client.

        Args:
            client: The service-role Supabase client.
        """
        self._client = client

    async def list_auth_users(
        self, *, page: int | None = None, per_page: int | None = None
    ) -> list[User]:
        """Return every registered user via the GoTrue admin API.

        Args:
            page: 1-based page number, or ``None`` for the API's default.
            per_page: Rows per page, or ``None`` for the API's default.

        Returns:
            The raw GoTrue ``User`` objects for this page.

        Raises:
            DatabaseError: The request failed.
        """
        try:
            return await self._client.auth.admin.list_users(page=page, per_page=per_page)
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error("Admin user listing failed: %s", type(error).__name__)
            msg = "Failed to list users."
            raise DatabaseError(msg) from error

    async def list_all_roles(self) -> list[dict[str, Any]]:
        """Return every row of ``public.user_roles``, across all users.

        Returns:
            Raw rows, each with ``user_id`` and ``role``.

        Raises:
            DatabaseError: The query failed.
        """
        try:
            response = await self._client.table(ROLES_TABLE).select("user_id, role").execute()
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error("Admin role listing failed: %s", type(error).__name__)
            msg = "Failed to list user roles."
            raise DatabaseError(msg) from error
        return response.data or []

    async def list_all_profiles(self) -> list[dict[str, Any]]:
        """Return every row of ``public.profiles``, across all users.

        Returns:
            Raw rows, each with ``id`` and ``display_name``.

        Raises:
            DatabaseError: The query failed.
        """
        try:
            response = await self._client.table(PROFILES_TABLE).select("id, display_name").execute()
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error("Admin profile listing failed: %s", type(error).__name__)
            msg = "Failed to list profiles."
            raise DatabaseError(msg) from error
        return response.data or []
