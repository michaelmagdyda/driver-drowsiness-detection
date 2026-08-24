"""Unit tests for the role cache.

A controllable monotonic clock replaces wall time, so TTL and expiry are tested
deterministically without sleeping.
"""

from __future__ import annotations

from uuid import UUID

import pytest

from app.core.constants import AppRole
from app.services import role_cache as module
from app.services.role_cache import RoleCache

pytestmark = pytest.mark.unit

USER_A = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
USER_B = UUID("11111111-2222-3333-4444-555555555555")


class Clock:
    """A monotonic clock the tests advance by hand."""

    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture(autouse=True)
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    fake = Clock()
    monkeypatch.setattr(module.time, "monotonic", fake)
    return fake


class TestCaching:
    def test_stores_and_returns(self):
        cache = RoleCache(ttl_seconds=60)
        cache.set(USER_A, AppRole.ADMIN)

        assert cache.get(USER_A) is AppRole.ADMIN

    def test_miss_returns_none(self):
        assert RoleCache(ttl_seconds=60).get(USER_A) is None

    def test_entry_expires_after_ttl(self, clock: Clock):
        cache = RoleCache(ttl_seconds=60)
        cache.set(USER_A, AppRole.USER)

        clock.advance(60)  # exactly at expiry -> expired
        assert cache.get(USER_A) is None

    def test_entry_lives_until_ttl(self, clock: Clock):
        cache = RoleCache(ttl_seconds=60)
        cache.set(USER_A, AppRole.USER)

        clock.advance(59)
        assert cache.get(USER_A) is AppRole.USER

    def test_entries_are_independent(self, clock: Clock):
        cache = RoleCache(ttl_seconds=60)
        cache.set(USER_A, AppRole.ADMIN)
        clock.advance(30)
        cache.set(USER_B, AppRole.USER)

        clock.advance(31)  # A (61s) expired, B (31s) alive
        assert cache.get(USER_A) is None
        assert cache.get(USER_B) is AppRole.USER


class TestDisabled:
    def test_ttl_zero_never_caches(self):
        cache = RoleCache(ttl_seconds=0)
        cache.set(USER_A, AppRole.ADMIN)

        assert cache.enabled is False
        assert cache.get(USER_A) is None

    def test_negative_ttl_never_caches(self):
        cache = RoleCache(ttl_seconds=-5)
        cache.set(USER_A, AppRole.ADMIN)

        assert cache.get(USER_A) is None


class TestInvalidation:
    def test_invalidate_forces_a_miss(self):
        cache = RoleCache(ttl_seconds=60)
        cache.set(USER_A, AppRole.ADMIN)

        cache.invalidate(USER_A)
        assert cache.get(USER_A) is None

    def test_invalidate_absent_key_is_safe(self):
        RoleCache(ttl_seconds=60).invalidate(USER_A)  # no raise

    def test_clear_empties_everything(self):
        cache = RoleCache(ttl_seconds=60)
        cache.set(USER_A, AppRole.ADMIN)
        cache.set(USER_B, AppRole.USER)

        cache.clear()
        assert cache.get(USER_A) is None
        assert cache.get(USER_B) is None


class TestPurge:
    def test_purge_removes_only_expired(self, clock: Clock):
        cache = RoleCache(ttl_seconds=60)
        cache.set(USER_A, AppRole.ADMIN)
        clock.advance(30)
        cache.set(USER_B, AppRole.USER)

        clock.advance(31)  # A expired, B alive
        removed = cache.purge_expired()

        assert removed == 1
        assert cache.get(USER_B) is AppRole.USER
