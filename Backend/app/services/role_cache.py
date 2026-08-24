"""In-memory TTL cache for resolved user roles.

Role resolution reads ``public.user_roles`` (decision E-D3). Without a cache that
is a database round-trip on every authorised request, which the 200 ms budget
(Coding Standards §24) cannot absorb on a hot path. This cache holds each user's
resolved role for a short, configurable TTL - 60 seconds by default.

The trade-off is bounded staleness: a role change (an admin demoted) takes effect
after at most one TTL. Setting the TTL to 0 disables caching entirely, making
revocation immediate at the cost of a lookup per request.

Single responsibility: this class only caches. It knows nothing about how a role
is computed or where it is stored - the service layer owns that. It is a
process-wide singleton (created once at startup in Phase E5); a per-request
instance would cache nothing.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from uuid import UUID

    from app.core.constants import AppRole


class RoleCache:
    """A time-bounded ``user_id`` -> role cache.

    Not guarded by a lock. Under an async event loop the only race is two
    coroutines missing concurrently and both resolving the same role - harmless,
    since resolution is idempotent and the second simply overwrites an identical
    value. Entries expire lazily, on access; see :meth:`purge_expired` for the
    bounded-growth caveat.
    """

    def __init__(self, ttl_seconds: int) -> None:
        """Initialise the cache.

        Args:
            ttl_seconds: How long an entry stays valid. ``0`` (or negative)
                disables caching: every :meth:`get` misses and :meth:`set` is a
                no-op.
        """
        self._ttl = ttl_seconds
        self._store: dict[UUID, tuple[AppRole, float]] = {}

    @property
    def enabled(self) -> bool:
        """Whether caching is active (a positive TTL)."""
        return self._ttl > 0

    def get(self, user_id: UUID) -> AppRole | None:
        """Return the cached role for a user, if present and unexpired.

        Args:
            user_id: The user to look up.

        Returns:
            The cached role, or ``None`` on a miss, on expiry, or when caching is
            disabled. An expired entry is evicted as a side effect.
        """
        if not self.enabled:
            return None
        entry = self._store.get(user_id)
        if entry is None:
            return None
        role, expires_at = entry
        if time.monotonic() >= expires_at:
            self._store.pop(user_id, None)
            return None
        return role

    def set(self, user_id: UUID, role: AppRole) -> None:
        """Cache a user's role for the configured TTL.

        Args:
            user_id: The user.
            role: The resolved role. Ignored when caching is disabled.
        """
        if not self.enabled:
            return
        self._store[user_id] = (role, time.monotonic() + self._ttl)

    def invalidate(self, user_id: UUID) -> None:
        """Drop a user's cached role, forcing a fresh resolution next time.

        Used when a role changes (Phase E7 admin actions) so the change is not
        masked by a stale entry for up to a TTL.

        Args:
            user_id: The user to evict.
        """
        self._store.pop(user_id, None)

    def clear(self) -> None:
        """Empty the cache entirely."""
        self._store.clear()

    def purge_expired(self) -> int:
        """Remove all expired entries.

        Expiry is otherwise lazy, so a large number of one-shot users would grow
        the cache until each is next accessed. A periodic call bounds that; Phase
        E5 can wire it to a timer if the deployment warrants it.

        Returns:
            The number of entries removed.
        """
        now = time.monotonic()
        expired = [key for key, (_, expires_at) in self._store.items() if now >= expires_at]
        for key in expired:
            self._store.pop(key, None)
        return len(expired)
