"""User repository - reads user identity data from Supabase.

Owns access to ``public.user_roles`` (and, later, ``public.profiles``). It is the
only place that knows how a role is stored; the service layer above asks for
"this user's roles" and never writes a query itself.

The client authenticates with the service-role key, which bypasses Row Level
Security, so this repository must always scope its reads to a specific
``user_id``. Enforcing ownership is the caller's contract - the repository never
returns another user's data because it never queries without the id.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.constants import AppRole
from app.core.exceptions import DatabaseError
from app.core.logging import get_logger

if TYPE_CHECKING:
    from uuid import UUID

    from supabase import AsyncClient

logger = get_logger(__name__)

ROLES_TABLE = "user_roles"


class UserRepository:
    """Reads user role assignments from Supabase.

    Constructed with an :class:`AsyncClient` (dependency injection), so tests can
    supply a fake and exercise every branch without a network. Stateless beyond
    the injected client - safe to create per request or share as a singleton.
    """

    def __init__(self, client: AsyncClient) -> None:
        """Store the injected Supabase client.

        Args:
            client: The service-role Supabase client.
        """
        self._client = client

    async def get_roles(self, user_id: UUID) -> list[AppRole]:
        """Return every application role assigned to a user.

        Reads ``public.user_roles`` filtered to ``user_id``. A user with no rows
        yields an empty list - that is a normal state, not an error, and the
        service layer maps it to the least-privileged default.

        A role string the application does not recognise is skipped and logged
        rather than raised: an enum value added to the database ahead of the code
        must not lock the user out.

        Args:
            user_id: The Supabase user id to look up.

        Returns:
            The recognised roles, in no particular order.

        Raises:
            DatabaseError: The query failed. The provider's exception is wrapped
                so callers never depend on the Supabase SDK's error types, and
                its message is not forwarded to the client.
        """
        try:
            response = (
                await self._client.table(ROLES_TABLE)
                .select("role")
                .eq("user_id", str(user_id))
                .execute()
            )
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error("Role lookup failed for user %s: %s", user_id, type(error).__name__)
            msg = "Failed to read user roles."
            raise DatabaseError(msg) from error

        roles: list[AppRole] = []
        for row in response.data or []:
            raw = row.get("role")
            try:
                roles.append(AppRole(raw))
            except ValueError:
                logger.warning("Ignoring unrecognised role '%s' for user %s", raw, user_id)
        return roles
