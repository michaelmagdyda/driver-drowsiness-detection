"""Unit tests for the JWKS public-key provider.

Runs against an in-process ``httpx.MockTransport`` rather than a real endpoint,
so caching, rotation, rate-limiting and failure handling are all exercised
deterministically and offline. A controllable monotonic clock replaces wall time
so TTL and rate-limit behaviour is tested without sleeping.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

import httpx
import pytest

from app.core.exceptions import InvalidTokenError, ServiceUnavailableError
from app.infra import jwks as jwks_module
from app.infra.jwks import JWKSProvider
from tests.unit.keys import SigningKey

if TYPE_CHECKING:
    from collections.abc import Callable

pytestmark = pytest.mark.unit

JWKS_URI = "https://testref.supabase.co/auth/v1/.well-known/jwks.json"

KEY_A = SigningKey("kid-a")
KEY_B = SigningKey("kid-b")


class Clock:
    """A monotonic clock the tests advance by hand."""

    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class JWKSEndpoint:
    """A fake JWKS endpoint: serves a configurable key set and counts fetches."""

    def __init__(self, keys: list[SigningKey]) -> None:
        self.keys = keys
        self.fetches = 0
        self.fail = False
        self.body_override: str | None = None

    def set_keys(self, keys: list[SigningKey]) -> None:
        self.keys = keys

    def handler(self, request: httpx.Request) -> httpx.Response:  # noqa: ARG002
        self.fetches += 1
        if self.fail:
            return httpx.Response(503, text="service unavailable")
        if self.body_override is not None:
            return httpx.Response(200, text=self.body_override)
        document = {"keys": [k.jwk_dict() for k in self.keys]}
        return httpx.Response(200, json=document)


@pytest.fixture(autouse=True)
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    """Install a controllable clock into the jwks module for every test.

    Autouse so time is deterministic throughout the suite. Tests that need to
    advance it request ``clock`` explicitly; the rest get a frozen clock without
    naming an unused parameter.
    """
    fake = Clock()
    monkeypatch.setattr(jwks_module.time, "monotonic", fake)
    return fake


@pytest.fixture
def make_provider() -> Callable[..., tuple[JWKSProvider, JWKSEndpoint]]:
    """Return a factory building a provider wired to a fake endpoint."""

    def _make(
        keys: list[SigningKey] | None = None,
        *,
        cache_ttl: int = 600,
        min_refresh: int = 30,
    ) -> tuple[JWKSProvider, JWKSEndpoint]:
        endpoint = JWKSEndpoint(keys if keys is not None else [KEY_A])
        client = httpx.AsyncClient(transport=httpx.MockTransport(endpoint.handler))
        provider = JWKSProvider(
            JWKS_URI,
            http_client=client,
            cache_ttl_seconds=cache_ttl,
            min_refresh_interval_seconds=min_refresh,
        )
        return provider, endpoint

    return _make


class TestFetchAndCache:
    async def test_first_lookup_fetches(self, make_provider: Any):
        provider, endpoint = make_provider([KEY_A])

        key = await provider.get_signing_key("kid-a")

        assert key.key_id == "kid-a"
        assert endpoint.fetches == 1

    async def test_second_lookup_is_cached(self, make_provider: Any):
        provider, endpoint = make_provider([KEY_A])

        await provider.get_signing_key("kid-a")
        await provider.get_signing_key("kid-a")

        assert endpoint.fetches == 1, "second lookup should hit the cache"

    async def test_cache_expiry_triggers_refetch(self, clock: Clock, make_provider: Any):
        provider, endpoint = make_provider([KEY_A], cache_ttl=600)

        await provider.get_signing_key("kid-a")
        clock.advance(601)
        await provider.get_signing_key("kid-a")

        assert endpoint.fetches == 2


class TestRotation:
    async def test_unknown_kid_triggers_refresh(self, clock: Clock, make_provider: Any):
        """A newly rotated-in key is picked up without waiting for TTL."""
        provider, endpoint = make_provider([KEY_A])
        await provider.get_signing_key("kid-a")
        assert endpoint.fetches == 1

        # Rotation: endpoint now serves a second key. Advance past the refresh
        # rate limit so the refresh is permitted.
        endpoint.set_keys([KEY_A, KEY_B])
        clock.advance(31)

        key = await provider.get_signing_key("kid-b")

        assert key.key_id == "kid-b"
        assert endpoint.fetches == 2

    async def test_genuinely_unknown_kid_is_invalid(self, make_provider: Any):
        provider, endpoint = make_provider([KEY_A])

        with pytest.raises(InvalidTokenError):
            await provider.get_signing_key("does-not-exist")

        # One fetch to discover the kid is absent; the empty cache guard does not
        # fire because KEY_A was loaded.
        assert endpoint.fetches == 1


class TestRateLimiting:
    async def test_refresh_is_rate_limited(self, clock: Clock, make_provider: Any):
        """A burst of unknown kids triggers at most one refresh per interval."""
        provider, endpoint = make_provider([KEY_A], min_refresh=30)
        await provider.get_signing_key("kid-a")  # fetch 1, sets last-attempt clock
        assert endpoint.fetches == 1

        # Move past the interval so the first bogus lookup is allowed to refresh;
        # the following four fall inside the new window and must not.
        clock.advance(31)
        for _ in range(5):
            with pytest.raises(InvalidTokenError):
                await provider.get_signing_key("bogus")

        assert endpoint.fetches == 2, "one refresh for the burst, not five"

    async def test_rate_limit_lifts_after_interval(self, clock: Clock, make_provider: Any):
        provider, endpoint = make_provider([KEY_A], min_refresh=30)
        await provider.get_signing_key("kid-a")
        with pytest.raises(InvalidTokenError):
            await provider.get_signing_key("bogus")
        fetches_before = endpoint.fetches

        clock.advance(31)
        with pytest.raises(InvalidTokenError):
            await provider.get_signing_key("bogus")

        assert endpoint.fetches == fetches_before + 1


class TestFailureHandling:
    async def test_cold_cache_and_outage_is_service_unavailable(self, make_provider: Any):
        provider, endpoint = make_provider([KEY_A])
        endpoint.fail = True

        with pytest.raises(ServiceUnavailableError):
            await provider.get_signing_key("kid-a")

    async def test_stale_cache_survives_a_transient_outage(self, clock: Clock, make_provider: Any):
        """A failed refresh must not wipe usable keys."""
        provider, endpoint = make_provider([KEY_A], cache_ttl=600)
        await provider.get_signing_key("kid-a")  # warm cache

        endpoint.fail = True
        clock.advance(601)  # cache now stale, refresh will be attempted and fail

        # The key is still served from the retained (stale) cache.
        key = await provider.get_signing_key("kid-a")
        assert key.key_id == "kid-a"

    async def test_malformed_document_does_not_crash(self, make_provider: Any):
        provider, endpoint = make_provider([KEY_A])
        endpoint.body_override = json.dumps({"unexpected": "shape"})

        with pytest.raises(ServiceUnavailableError):
            await provider.get_signing_key("kid-a")

    async def test_invalid_json_does_not_crash(self, make_provider: Any):
        provider, endpoint = make_provider([KEY_A])
        endpoint.body_override = "<html>not json</html>"

        with pytest.raises(ServiceUnavailableError):
            await provider.get_signing_key("kid-a")


class TestConcurrency:
    async def test_concurrent_cold_lookups_fetch_once(self, make_provider: Any):
        """A burst against a cold cache collapses to a single fetch."""
        import asyncio

        provider, endpoint = make_provider([KEY_A])

        results = await asyncio.gather(*(provider.get_signing_key("kid-a") for _ in range(10)))

        assert all(k.key_id == "kid-a" for k in results)
        assert endpoint.fetches == 1, "the lock should collapse the stampede"
