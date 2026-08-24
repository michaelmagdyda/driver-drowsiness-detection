"""Authentication service - turns verified token claims into a principal.

The bridge between token verification (Phase E2, offline) and the database
(Phase E3/E4). Given the claims from an authentic token, it resolves the caller's
application role and returns the :class:`~app.schemas.auth.AuthenticatedUser` that
endpoints operate on.

Layer position: service. It orchestrates a repository (infra) and a cache, and
contains the one business rule involved - how a set of role rows collapses to a
single effective role. It never builds an HTTP response and never touches the AI
domain (decision E-D4), so authentication and inference stay fully independent.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.constants import AppRole
from app.core.logging import get_logger
from app.schemas.auth import AuthenticatedUser

if TYPE_CHECKING:
    from uuid import UUID

    from app.infra.repositories.user_repository import UserRepository
    from app.schemas.auth import TokenClaims
    from app.services.role_cache import RoleCache

logger = get_logger(__name__)


class AuthService:
    """Resolves a user's effective role and assembles the principal.

    Collaborators are injected (dependency inversion): a :class:`UserRepository`
    for the data and a :class:`RoleCache` for the TTL cache. The cache must be the
    process-wide singleton, so a role stays cached across requests; the service
    itself may be created per request.
    """

    def __init__(self, repository: UserRepository, role_cache: RoleCache) -> None:
        """Store the injected collaborators.

        Args:
            repository: Reads role assignments from Supabase.
            role_cache: Shared TTL cache of resolved roles.
        """
        self._repository = repository
        self._cache = role_cache

    async def resolve_role(self, user_id: UUID) -> AppRole:
        """Return a user's single effective application role.

        Serves from the cache when possible; on a miss, reads every assigned role
        and collapses them by priority. A user may hold more than one row, so the
        highest wins: ``admin`` outranks ``user``, and a user with no rows at all
        defaults to ``user`` - the least-privileged, safe direction to fail.

        The resolved role is cached (subject to the configured TTL) before it is
        returned.

        Args:
            user_id: The authenticated user's id.

        Returns:
            The effective :class:`~app.core.constants.AppRole`.

        Raises:
            DatabaseError: Propagated from the repository if the lookup fails.
                Auth deliberately fails closed rather than assuming a role.
        """
        cached = self._cache.get(user_id)
        if cached is not None:
            return cached

        roles = await self._repository.get_roles(user_id)
        effective = AppRole.ADMIN if AppRole.ADMIN in roles else AppRole.USER
        self._cache.set(user_id, effective)
        return effective

    async def authenticate(self, claims: TokenClaims) -> AuthenticatedUser:
        """Build the principal for an authentic token.

        The token has already been cryptographically verified (Phase E2); this
        adds the application role, which the token never carries - roles come
        only from ``public.user_roles`` (decision E-D4 / the privilege-escalation
        guard), never from a claim.

        Args:
            claims: Validated claims from a verified access token.

        Returns:
            The :class:`AuthenticatedUser` endpoints receive.

        Raises:
            DatabaseError: If the role lookup fails.
        """
        role = await self.resolve_role(claims.user_id)
        return AuthenticatedUser(id=claims.user_id, email=claims.email, role=role)
