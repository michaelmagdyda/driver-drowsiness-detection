"""JWT verification primitives.

The security kernel: given a bearer token and a public signing key, decide
whether it is an authentic, unexpired Supabase access token for *this* project,
and extract its claims.

Doc-mandated location - 03_Backend_Architecture.md §7 lists ``core/security.py``
with the responsibility "JWT Validation".

Signing model
-------------
This project's Supabase instance signs with **ES256** - ECDSA over the NIST
P-256 curve, an *asymmetric* scheme. Tokens are verified against a **public**
key, so the backend holds no secret capable of minting tokens. The public keys
are published at a JWKS endpoint and selected per token by the ``kid`` header.

Design constraints, all deliberate:

**This module performs no I/O.** It imports nothing that opens a socket or a
file. Verification is done against a key that is handed in already resolved, so
the crypto path is offline and directly unit-testable. Fetching the public keys
is a separate, cached concern that lives behind the :class:`PublicKeyProvider`
abstraction and is implemented in the infrastructure layer.

**Pure primitives.** :func:`decode_access_token` takes an explicit key and
verifies synchronously. :func:`verify_access_token` is the async orchestrator
that resolves the key through an injected provider and then calls the primitive;
it depends only on the abstraction, never on a concrete HTTP client.

**Provider-agnostic.** The kernel works with any public key from any source. It
knows nothing about Supabase, JWKS or HTTP - only about tokens and keys.

**No AI imports** (decision E-D4). Authentication and inference share nothing.

Layer position: ``core``. It may not import from ``services``, ``infra``,
``api`` or ``domain``; it *defines* the :class:`PublicKeyProvider` interface that
``infra`` implements (dependency inversion).
"""

from __future__ import annotations

import hashlib
from typing import Final, Protocol, runtime_checkable

import jwt
from jwt import PyJWK

from app.core.exceptions import AuthenticationError, InvalidTokenError
from app.core.logging import get_logger
from app.schemas.auth import TokenClaims

logger = get_logger(__name__)


# =============================================================================
# Algorithm pinning
# =============================================================================
# Hardcoded, never read from configuration or from the token header. The pin is
# the single most important line in the module. It closes three forgery routes:
#
#   alg=none
#       A token declaring no algorithm and an empty signature. A verifier that
#       honours the header's `alg` accepts it and every claim it asserts.
#
#   Algorithm substitution / key confusion
#       With asymmetric keys this is the dangerous one. The signing key is
#       public. An attacker takes that public key and signs an *HS256* token
#       with it, using the public-key bytes as an HMAC secret. A verifier that
#       accepts HMAC would recompute the same HMAC with the same public bytes
#       and accept the forgery. Pinning to ES256 means an HS256 token is never
#       even considered.
#
#   Curve/family downgrade
#       Only ES256 is accepted, so a token signed with any other algorithm -
#       RS256, ES512, EdDSA - is rejected regardless of the key supplied.
#
# PyJWT is handed exactly this allow-list and refuses to consult the token
# header for anything outside it.
# =============================================================================

SIGNING_ALGORITHM: Final[str] = "ES256"
"""ECDSA over P-256. The algorithm Supabase signs this project's tokens with."""

ALLOWED_ALGORITHMS: Final[tuple[str, ...]] = (SIGNING_ALGORITHM,)
"""Exhaustive allow-list handed to PyJWT. Never widen this from configuration."""

REQUIRED_CLAIMS: Final[tuple[str, ...]] = ("exp", "iat", "sub", "aud", "iss")
"""Claims that must be present.

Absence is rejected rather than defaulting to a permissive value - a token with
no ``exp`` would otherwise never expire.
"""

BEARER_SCHEME: Final[str] = "bearer"
"""Authorisation scheme, compared case-insensitively per RFC 7235."""


# =============================================================================
# Uniform failure
# =============================================================================
# Every token-related failure returns this one message. Distinguishing
# "expired" from "bad signature" from "unknown key" tells an attacker which
# property of their forgery to fix next; a uniform response tells them nothing.
# The precise cause is logged server-side against the request id.
# =============================================================================

_GENERIC_FAILURE_MESSAGE: Final[str] = (
    "The provided authentication token is invalid or has expired."
)

_FINGERPRINT_LENGTH: Final[int] = 12


# =============================================================================
# Public-key provider abstraction
# =============================================================================


@runtime_checkable
class PublicKeyProvider(Protocol):
    """Resolves a token's signing key from its ``kid``.

    The seam between the offline crypto kernel and the (cached, network-bound)
    key source. ``core`` defines this interface; the infrastructure layer
    implements it against a JWKS endpoint. Because the kernel depends only on
    this abstraction, it is provider-agnostic and remains unit-testable with a
    trivial in-memory fake.
    """

    async def get_signing_key(self, kid: str) -> PyJWK:
        """Return the public key with the given id.

        Args:
            kid: Key identifier taken from the token header.

        Returns:
            The matching public key.

        Raises:
            InvalidTokenError: No key with this id exists.
            ServiceUnavailableError: The key set could not be obtained at all.
        """
        ...


# =============================================================================
# Internal helpers
# =============================================================================


def _fingerprint(token: str) -> str:
    """Return a short, non-reversible identifier for a token.

    Lets repeated failures from one client be correlated in the logs without
    ever writing the token itself (Coding Standards §13).

    Args:
        token: The raw token. Never logged, only hashed.

    Returns:
        The first twelve hex characters of the token's SHA-256 digest.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:_FINGERPRINT_LENGTH]


def _reject(token: str, reason: str) -> InvalidTokenError:
    """Log the true cause and build the caller-facing error.

    Args:
        token: The rejected token, used only to derive a fingerprint.
        reason: Specific cause, for operators. Never sent to the client.

    Returns:
        An :class:`InvalidTokenError` carrying the uniform public message.
    """
    logger.warning("Token rejected (%s): %s", _fingerprint(token), reason)
    return InvalidTokenError(_GENERIC_FAILURE_MESSAGE)


# =============================================================================
# Header parsing
# =============================================================================


def extract_bearer_token(authorization_header: str | None) -> str:
    """Pull the raw token out of an ``Authorization`` header.

    Args:
        authorization_header: Raw header value, or ``None`` when absent.

    Returns:
        The token, with surrounding whitespace removed.

    Raises:
        AuthenticationError: The header is missing or empty. Distinguished from
            an invalid token on purpose - "you sent no credentials" is not an
            oracle, and the frontend needs it to know a login is required rather
            than that a refresh failed.
        InvalidTokenError: The header is present but malformed.
    """
    if authorization_header is None or not authorization_header.strip():
        msg = "Authentication is required to access this resource."
        raise AuthenticationError(msg)

    parts = authorization_header.strip().split(maxsplit=1)
    expected_parts = 2
    if len(parts) != expected_parts or parts[0].lower() != BEARER_SCHEME:
        logger.warning("Malformed Authorization header: expected 'Bearer <token>'")
        raise InvalidTokenError(_GENERIC_FAILURE_MESSAGE)

    # No emptiness check on parts[1] is needed: the header is stripped before
    # splitting, so `split(maxsplit=1)` cannot yield a blank second element -
    # "Bearer   " collapses to a single part and is rejected above.
    return parts[1]


def get_unverified_kid(token: str) -> str:
    """Read the key id from a token header *without* verifying the token.

    Reading the header is a plain base64 decode and trusts nothing: the value is
    used only to select which public key to verify *against*. The signature is
    still checked afterwards, so a forged ``kid`` cannot help an attacker - at
    worst it selects the wrong key and verification fails.

    The header ``alg`` is checked against the allow-list here too, as an early,
    cheap rejection. :func:`decode_access_token` enforces it again during
    verification; this is defence in depth, not the primary control.

    Args:
        token: Raw JWT, without the ``Bearer`` prefix.

    Returns:
        The ``kid`` header value.

    Raises:
        InvalidTokenError: The header is unreadable, declares a disallowed
            algorithm, or carries no ``kid``.
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as error:
        raise _reject(token, f"unreadable header ({type(error).__name__})") from error

    algorithm = header.get("alg")
    if algorithm not in ALLOWED_ALGORITHMS:
        raise _reject(token, f"disallowed algorithm in header: {algorithm!r}")

    kid = header.get("kid")
    if not kid or not isinstance(kid, str):
        # Asymmetric Supabase tokens always carry a kid; its absence marks a
        # legacy or hand-built token that this system does not accept.
        raise _reject(token, "token header carries no key id (kid)")

    return kid


# =============================================================================
# Verification
# =============================================================================


def decode_access_token(
    token: str,
    *,
    key: PyJWK,
    audience: str,
    issuer: str,
    leeway_seconds: int = 0,
) -> TokenClaims:
    """Verify a token against a resolved public key and return its claims.

    Pure and synchronous: given the key, no I/O occurs. Verification is layered -
    PyJWT establishes cryptographic authenticity and temporal validity;
    :class:`TokenClaims` then establishes that the payload has the shape the
    application requires.

    Checks applied:

    1. Algorithm is ES256 - from :data:`ALLOWED_ALGORITHMS`, never from the
       token header. Rejects ``alg=none``, HMAC key-confusion and downgrades.
    2. ECDSA signature verifies against ``key``.
    3. All of :data:`REQUIRED_CLAIMS` are present.
    4. ``exp`` is in the future, within ``leeway_seconds``.
    5. ``aud`` equals the expected audience.
    6. ``iss`` equals the expected issuer - rejects a validly signed token from
       a *different* Supabase project.
    7. ``sub`` parses as a UUID.

    Args:
        token: Raw JWT, without the ``Bearer`` prefix.
        key: Public key resolved from the token's ``kid``.
        audience: Expected ``aud``, normally ``"authenticated"``.
        issuer: Expected ``iss``, normally ``{SUPABASE_URL}/auth/v1``.
        leeway_seconds: Clock-skew tolerance applied to time-based claims.

    Returns:
        The validated :class:`TokenClaims`.

    Raises:
        InvalidTokenError: Any check failed. The message is identical in every
            case; the specific cause goes to the log.
    """
    try:
        payload = jwt.decode(
            token,
            key=key,
            algorithms=list(ALLOWED_ALGORITHMS),
            audience=audience,
            issuer=issuer,
            leeway=leeway_seconds,
            options={
                "require": list(REQUIRED_CLAIMS),
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
            },
        )
    except jwt.ExpiredSignatureError as error:
        raise _reject(token, "expired") from error
    except jwt.InvalidAudienceError as error:
        raise _reject(token, "audience mismatch") from error
    except jwt.InvalidIssuerError as error:
        raise _reject(token, "issuer mismatch") from error
    except jwt.InvalidAlgorithmError as error:
        raise _reject(token, "disallowed algorithm") from error
    except jwt.InvalidSignatureError as error:
        raise _reject(token, "signature mismatch") from error
    except jwt.MissingRequiredClaimError as error:
        raise _reject(token, f"missing required claim: {error.claim}") from error
    except jwt.PyJWTError as error:
        # Base of every PyJWT failure. Catches DecodeError and anything a future
        # version adds, so a new failure mode can never fall through as a 500.
        raise _reject(token, f"malformed token ({type(error).__name__})") from error

    try:
        return TokenClaims.model_validate(payload)
    except ValueError as error:
        # Authentic and unexpired, but structurally wrong - a non-UUID `sub`,
        # for instance. Rejected rather than passed to the database layer.
        raise _reject(token, f"claim validation failed ({type(error).__name__})") from error


async def verify_access_token(
    token: str,
    *,
    key_provider: PublicKeyProvider,
    audience: str,
    issuer: str,
    leeway_seconds: int = 0,
) -> TokenClaims:
    """Resolve the signing key and verify a token end to end.

    The one asynchronous function here, and the entry point call sites use. It
    performs no I/O itself: the network-bound step is delegated to the injected
    :class:`PublicKeyProvider`, so this module still imports nothing that touches
    a socket. Key resolution is normally a cache hit, so verification stays
    effectively offline after the first fetch.

    Args:
        token: Raw JWT, without the ``Bearer`` prefix.
        key_provider: Resolves the public key from the token's ``kid``.
        audience: Expected ``aud``.
        issuer: Expected ``iss``.
        leeway_seconds: Clock-skew tolerance.

    Returns:
        The validated :class:`TokenClaims`.

    Raises:
        InvalidTokenError: The token is malformed, forged, expired, or names an
            unknown key.
        ServiceUnavailableError: The signing keys could not be obtained at all.
    """
    kid = get_unverified_kid(token)
    key = await key_provider.get_signing_key(kid)
    return decode_access_token(
        token,
        key=key,
        audience=audience,
        issuer=issuer,
        leeway_seconds=leeway_seconds,
    )
