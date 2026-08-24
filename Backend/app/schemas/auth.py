"""Authentication schemas.

Two models with different jobs, and the distinction matters:

:class:`TokenClaims`
    What the *token* asserts. Produced by verification, trusted only as far as
    the signature goes. Carries no application role.

:class:`AuthenticatedUser`
    Who the caller *is*, as the application understands it. Combines verified
    claims with the role resolved from the database in Phase E4. This is what
    endpoints receive.

Keeping them separate is a security boundary, not bookkeeping. A single merged
model would invite populating the role from whatever the token happened to say -
which is exactly the privilege-escalation route the database schema was designed
to prevent.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import AppRole


class TokenClaims(BaseModel):
    """Validated claims from a Supabase access token.

    Applied *after* cryptographic verification as a second, structural check.
    PyJWT proves the token is authentic and unexpired; this proves the payload
    has the shape the rest of the application assumes. ``sub`` in particular
    becomes a foreign key into ``auth.users`` - a malformed value must be
    rejected here rather than reaching the database layer.

    Attributes:
        sub: Supabase user id. Matches ``auth.users.id``.
        email: Registered email, when the token carries one.
        aud: Audience claim. Verified by PyJWT before this model is built.
        iss: Issuer claim. Likewise pre-verified.
        exp: Expiry, as a timezone-aware datetime.
        iat: Issued-at, as a timezone-aware datetime.
        postgres_role: See the warning below.
        session_id: Supabase session identifier, when present.
        app_metadata: Provider metadata, e.g. the sign-in method.
        user_metadata: User-supplied profile metadata.

    Warning:
        ``postgres_role`` maps the token's ``role`` claim, whose value is the
        **Postgres** role - almost always the literal string ``"authenticated"``.
        It is *not* the application role and must never be used for
        authorisation. Every signed-in user carries the same value, so treating
        it as an app role would grant everyone identical authority.

        Application roles live in ``public.user_roles`` and are resolved by
        :class:`AuthenticatedUser` in Phase E4. The field is deliberately
        renamed here so that reading it as ``claims.role`` is impossible.
    """

    model_config = ConfigDict(
        populate_by_name=True,
        # Supabase adds claims over time (`aal`, `amr`, `is_anonymous`, ...).
        # Rejecting unknown claims would turn any upstream addition into a
        # total authentication outage.
        extra="ignore",
    )

    sub: UUID
    email: str | None = None
    aud: str | list[str]
    iss: str
    exp: datetime
    iat: datetime

    postgres_role: str | None = Field(default=None, alias="role")
    session_id: str | None = None

    app_metadata: dict[str, Any] = Field(default_factory=dict)
    user_metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def user_id(self) -> UUID:
        """Return the authenticated user's id.

        A named alias for ``sub``. Call sites read better as ``claims.user_id``
        than as a three-letter JWT abbreviation.

        Returns:
            The Supabase user id.
        """
        return self.sub


class AuthenticatedUser(BaseModel):
    """The principal an endpoint operates on behalf of.

    Assembled in Phase E4 from verified :class:`TokenClaims` plus a role read
    from ``public.user_roles``. Endpoints receive this - never a raw token, and
    never raw claims - so no handler is in a position to make an authorisation
    decision from an unverified source.

    Attributes:
        id: Supabase user id, for ownership checks and foreign keys.
        email: Registered email, when known.
        role: Application role resolved from the database.
    """

    model_config = ConfigDict(frozen=True)
    """Immutable.

    A principal that could be mutated mid-request would let a downstream helper
    escalate its own caller's privileges. Freezing removes the possibility.
    """

    id: UUID
    email: str | None = None
    role: AppRole = AppRole.USER
    """Defaults to the least privilege.

    A user with no row in ``user_roles`` - or a role lookup that returns
    nothing - is treated as a plain user. The safe direction to fail.
    """

    @property
    def is_admin(self) -> bool:
        """Whether this principal holds the administrator role.

        Returns:
            ``True`` only for :attr:`~app.core.constants.AppRole.ADMIN`.
        """
        return self.role is AppRole.ADMIN
