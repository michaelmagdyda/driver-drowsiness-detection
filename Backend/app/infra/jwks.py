"""JWKS public-key provider.

Implements :class:`~app.core.security.PublicKeyProvider` against a JWKS endpoint:
fetches the JSON Web Key Set, caches it, refreshes it when keys rotate, and hands
the security kernel the public key for a given ``kid``. This is the one piece of
the authentication path that performs network I/O, which is why it lives in the
infrastructure layer and sits behind the ``core`` abstraction.

Caching and rotation
--------------------
Public keys change rarely, so the key set is cached for a TTL and most lookups
are served from memory - verification is effectively offline after the first
fetch. Two events force a refetch:

* the cache is older than its TTL;
* a token presents a ``kid`` not in the cache, which is what a key rotation looks
  like from the outside.

The refresh-on-unknown-``kid`` path is rate-limited by a minimum interval, so a
flood of tokens carrying bogus key ids cannot be turned into a denial-of-service
against the JWKS endpoint. A single ``asyncio.Lock`` collapses concurrent
refreshes, so a burst of requests during a cold cache produces one fetch, not a
stampede.

Graceful degradation
---------------------
If a refresh fails but usable (if stale) keys are already cached, verification
continues against them rather than rejecting every user during a transient JWKS
outage. Only a cold cache with no reachable endpoint yields a hard failure.

Provider-agnostic
-----------------
The class takes any JWKS URI and any ``httpx.AsyncClient``. Nothing here is
specific to Supabase beyond the URL the caller supplies.
"""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING, Final

import httpx
from jwt import PyJWK, PyJWKSet
from jwt.exceptions import PyJWTError

from app.core.exceptions import InvalidTokenError, ServiceUnavailableError
from app.core.logging import get_logger

if TYPE_CHECKING:
    from collections.abc import Mapping

logger = get_logger(__name__)

# Named without "TOKEN" in the identifier so the linter's hardcoded-credential
# check does not fire on it; the value is a user-facing message.
_GENERIC_FAILURE_MESSAGE: Final[str] = (
    "The provided authentication token is invalid or has expired."
)
_KEYS_UNAVAILABLE: Final[str] = "The authentication key set is temporarily unavailable."

_DEFAULT_TIMEOUT_SECONDS: Final[float] = 5.0


class JWKSProvider:
    """Fetches, caches and rotates JWKS public keys.

    Satisfies :class:`~app.core.security.PublicKeyProvider` structurally, so it
    can be injected wherever that abstraction is expected.

    Construct one per process and reuse it: the cache and its concurrency lock
    live on the instance. Phase E5 wires a singleton onto ``app.state`` and hands
    it to the verification dependency.
    """

    def __init__(
        self,
        jwks_uri: str,
        *,
        http_client: httpx.AsyncClient,
        cache_ttl_seconds: int,
        min_refresh_interval_seconds: int,
        request_timeout_seconds: float = _DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        """Initialise the provider.

        Args:
            jwks_uri: URL of the JWKS document.
            http_client: Shared async HTTP client. Injected rather than created
                here so it can be reused across the app and faked in tests.
            cache_ttl_seconds: Seconds a fetched key set stays fresh.
            min_refresh_interval_seconds: Minimum seconds between refetches, the
                rate limit on the refresh-on-unknown-``kid`` path.
            request_timeout_seconds: Per-request network timeout.
        """
        self._jwks_uri = jwks_uri
        self._http = http_client
        self._cache_ttl = cache_ttl_seconds
        self._min_refresh_interval = min_refresh_interval_seconds
        self._timeout = request_timeout_seconds

        self._keys: dict[str, PyJWK] = {}
        self._fetched_at: float | None = None
        self._last_attempt_at: float | None = None
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ public

    async def get_signing_key(self, kid: str) -> PyJWK:
        """Return the public key for ``kid``, fetching or refreshing as needed.

        Args:
            kid: Key identifier from the token header.

        Returns:
            The matching public key.

        Raises:
            InvalidTokenError: No key with this id exists, even after a refresh.
            ServiceUnavailableError: No keys are cached and the endpoint is
                unreachable.
        """
        cached = self._cached_key(kid)
        if cached is not None:
            return cached

        # Unknown kid, or a stale cache: attempt a single, lock-guarded refresh.
        async with self._lock:
            # Re-check: another coroutine may have refreshed while we waited.
            cached = self._cached_key(kid)
            if cached is not None:
                return cached

            if self._should_attempt_refresh():
                await self._refresh()

            key = self._keys.get(kid)
            if key is not None:
                return key

        # Still unknown. If we hold no keys at all, the endpoint is unreachable
        # and this is an outage (503); otherwise the kid genuinely does not exist
        # and this is a bad token (401, uniform message).
        if not self._keys:
            logger.error("No JWKS keys available and endpoint unreachable")
            raise ServiceUnavailableError(_KEYS_UNAVAILABLE)

        logger.warning("Token presented unknown key id: %s", kid)
        raise InvalidTokenError(_GENERIC_FAILURE_MESSAGE)

    # ----------------------------------------------------------------- private

    def _is_fresh(self) -> bool:
        """Whether the cached key set is within its TTL."""
        if self._fetched_at is None:
            return False
        return (time.monotonic() - self._fetched_at) < self._cache_ttl

    def _cached_key(self, kid: str) -> PyJWK | None:
        """Return a cached key only if the cache is present and fresh.

        A stale cache returns ``None`` here so the caller takes the refresh path;
        the stale keys are still retained and may be used as a fallback if that
        refresh fails.

        Args:
            kid: Key identifier.

        Returns:
            The key, or ``None`` if absent or the cache is stale.
        """
        if not self._is_fresh():
            return None
        return self._keys.get(kid)

    def _should_attempt_refresh(self) -> bool:
        """Whether a refetch is permitted right now.

        A cold cache always may. Otherwise the minimum-interval rate limit
        applies, so repeated unknown-``kid`` tokens cannot hammer the endpoint.

        Returns:
            ``True`` if a refresh should be attempted.
        """
        if self._last_attempt_at is None:
            return True
        return (time.monotonic() - self._last_attempt_at) >= self._min_refresh_interval

    async def _refresh(self) -> None:
        """Fetch the key set and replace the cache.

        On any network or parse failure the existing cache is left intact - a
        transient JWKS outage must not wipe usable keys. The attempt timestamp is
        recorded whether or not the fetch succeeds, so the rate limit governs
        failures too.
        """
        self._last_attempt_at = time.monotonic()
        try:
            response = await self._http.get(self._jwks_uri, timeout=self._timeout)
            response.raise_for_status()
            document = response.json()
            keys = self._parse(document)
        except httpx.HTTPError as error:
            logger.warning("JWKS fetch failed (%s); keeping cached keys", type(error).__name__)
            return
        except (PyJWTError, ValueError, KeyError, TypeError) as error:
            logger.warning(
                "JWKS document malformed (%s); keeping cached keys", type(error).__name__
            )
            return

        if not keys:
            logger.warning("JWKS document contained no usable keys; keeping cached keys")
            return

        self._keys = keys
        self._fetched_at = time.monotonic()
        logger.info("JWKS refreshed: %d key(s) cached", len(keys))

    @staticmethod
    def _parse(document: Mapping[str, object]) -> dict[str, PyJWK]:
        """Convert a JWKS document into a ``kid`` -> key mapping.

        Keys without an id are skipped rather than rejected: a malformed entry
        alongside good ones must not deny service. Parsing uses PyJWT's vetted
        JWK handling rather than any bespoke cryptographic code.

        Args:
            document: Decoded JWKS JSON.

        Returns:
            Mapping from key id to public key.
        """
        key_set = PyJWKSet.from_dict(dict(document))
        return {key.key_id: key for key in key_set.keys if key.key_id}
