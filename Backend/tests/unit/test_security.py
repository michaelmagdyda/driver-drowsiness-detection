"""Unit tests for the JWT verification kernel (asymmetric / ES256).

Weighted towards adversarial cases. A verifier that accepts valid tokens is easy;
the security value is entirely in what it refuses, so forged tokens are built by
hand rather than trusting a library to decline to produce them.
"""

from __future__ import annotations

import socket
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.core.constants import AppRole
from app.core.exceptions import (
    AuthenticationError,
    InvalidTokenError,
    ServiceUnavailableError,
)
from app.core.security import (
    ALLOWED_ALGORITHMS,
    SIGNING_ALGORITHM,
    PublicKeyProvider,
    decode_access_token,
    extract_bearer_token,
    get_unverified_kid,
    verify_access_token,
)
from app.schemas.auth import AuthenticatedUser
from tests.unit.keys import (
    AUDIENCE,
    ISSUER,
    USER_ID,
    SigningKey,
    forge_hs256_with_public_key,
    forge_unsigned,
)

pytestmark = pytest.mark.unit

KEY = SigningKey("test-kid-1")


def decode(token: str, *, leeway: int = 0) -> Any:
    """Decode against the standard test key and parameters."""
    return decode_access_token(
        token, key=KEY.public_jwk(), audience=AUDIENCE, issuer=ISSUER, leeway_seconds=leeway
    )


# =============================================================================
# Static configuration
# =============================================================================


class TestAlgorithmPin:
    """The allow-list is asymmetric and singular."""

    def test_only_es256_is_allowed(self):
        assert ALLOWED_ALGORITHMS == ("ES256",)
        assert SIGNING_ALGORITHM == "ES256"


# =============================================================================
# Forgery rejection - the core security value
# =============================================================================


class TestForgeryRejection:
    """alg=none, key confusion and algorithm downgrade."""

    def test_rejects_alg_none(self):
        with pytest.raises(InvalidTokenError):
            decode(forge_unsigned(KEY, "none"))

    @pytest.mark.parametrize("variant", ["None", "NONE", "nOnE"])
    def test_rejects_alg_none_case_variants(self, variant: str):
        with pytest.raises(InvalidTokenError):
            decode(forge_unsigned(KEY, variant))

    def test_rejects_hs256_signed_with_public_key(self):
        """The asymmetric key-confusion attack.

        An attacker takes the public signing key and signs an HS256 token with
        it. A verifier that accepts HMAC would recompute the same digest with
        the same public bytes and accept the forgery. Pinning ES256 defeats it:
        the HS256 token is never even considered.
        """
        forged = forge_hs256_with_public_key(KEY)

        with pytest.raises(InvalidTokenError):
            decode(forged)

    def test_rejects_rs256(self):
        """A different asymmetric family is refused outright."""
        import jwt
        from cryptography.hazmat.primitives.asymmetric import rsa

        rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        now = int(datetime.now(UTC).timestamp())
        token = jwt.encode(
            {"sub": USER_ID, "aud": AUDIENCE, "iss": ISSUER, "iat": now, "exp": now + 3600},
            rsa_key,
            algorithm="RS256",
            headers={"kid": KEY.kid},
        )

        with pytest.raises(InvalidTokenError):
            decode(token)

    def test_rejects_token_signed_by_a_different_key(self):
        """A real ES256 token signed by a key we do not trust."""
        attacker = SigningKey("test-kid-1")  # same kid, different private key

        with pytest.raises(InvalidTokenError):
            decode(attacker.sign())


# =============================================================================
# Valid tokens and claim structure
# =============================================================================


class TestValidToken:
    """The happy path and claim shaping."""

    def test_accepts_a_valid_token(self):
        claims = decode(KEY.sign())

        assert claims.sub == UUID(USER_ID)
        assert claims.user_id == UUID(USER_ID)
        assert claims.email == "driver@example.com"
        assert claims.iss == ISSUER

    @pytest.mark.parametrize("garbage", ["", "x", "a.b", "a.b.c.d", "...", "not-a-token"])
    def test_rejects_malformed_input(self, garbage: str):
        with pytest.raises(InvalidTokenError):
            decode(garbage)

    def test_rejects_non_uuid_subject(self):
        with pytest.raises(InvalidTokenError):
            decode(KEY.sign(sub="not-a-uuid"))

    @pytest.mark.parametrize("claim", ["exp", "iat", "sub", "aud", "iss"])
    def test_rejects_missing_required_claim(self, claim: str):
        import jwt

        now = int(datetime.now(UTC).timestamp())
        payload = {
            "sub": USER_ID,
            "aud": AUDIENCE,
            "iss": ISSUER,
            "iat": now,
            "exp": now + 3600,
        }
        del payload[claim]
        # sign directly so the claim really is absent
        token = jwt.encode(
            payload, KEY._private, algorithm="ES256", headers={"kid": KEY.kid}  # noqa: SLF001
        )

        with pytest.raises(InvalidTokenError):
            decode(token)

    def test_ignores_unknown_claims(self):
        """Supabase adds claims over time; unknown ones must not break anything."""
        claims = decode(KEY.sign(aal="aal1", amr=[{"method": "password"}], is_anonymous=False))

        assert claims.sub == UUID(USER_ID)


# =============================================================================
# Temporal validation
# =============================================================================


class TestTemporalValidation:
    def test_rejects_expired_token(self):
        past = int((datetime.now(UTC) - timedelta(hours=2)).timestamp())
        with pytest.raises(InvalidTokenError):
            decode(KEY.sign(exp=past))

    def test_leeway_tolerates_small_skew(self):
        just_expired = int((datetime.now(UTC) - timedelta(seconds=30)).timestamp())
        claims = decode(KEY.sign(exp=just_expired), leeway=60)

        assert claims.sub == UUID(USER_ID)

    def test_leeway_is_not_a_grace_period(self):
        long_expired = int((datetime.now(UTC) - timedelta(seconds=600)).timestamp())
        with pytest.raises(InvalidTokenError):
            decode(KEY.sign(exp=long_expired), leeway=60)


# =============================================================================
# Audience and issuer
# =============================================================================


class TestAudienceAndIssuer:
    def test_rejects_wrong_audience(self):
        with pytest.raises(InvalidTokenError):
            decode(KEY.sign(aud="anon"))

    def test_rejects_token_from_another_project(self):
        with pytest.raises(InvalidTokenError):
            decode(KEY.sign(iss="https://someone-else.supabase.co/auth/v1"))


# =============================================================================
# No information disclosure
# =============================================================================


class TestUniformFailure:
    def test_all_failures_share_one_message(self):
        past = int((datetime.now(UTC) - timedelta(hours=2)).timestamp())
        failures = [
            KEY.sign(exp=past),
            KEY.sign(aud="anon"),
            KEY.sign(iss="https://elsewhere.supabase.co/auth/v1"),
            SigningKey("test-kid-1").sign(),  # wrong key
            forge_hs256_with_public_key(KEY),
            forge_unsigned(KEY),
            "utter-garbage",
        ]

        messages = set()
        for token in failures:
            with pytest.raises(InvalidTokenError) as caught:
                decode(token)
            messages.add(caught.value.message)

        assert len(messages) == 1, f"leaks which check failed: {messages}"

    def test_error_never_contains_the_token(self):
        token = SigningKey("test-kid-1").sign()  # wrong key

        with pytest.raises(InvalidTokenError) as caught:
            decode(token)

        assert token not in str(caught.value)


# =============================================================================
# kid extraction
# =============================================================================


class TestUnverifiedKid:
    def test_extracts_kid(self):
        assert get_unverified_kid(KEY.sign()) == KEY.kid

    def test_rejects_missing_kid(self):
        import jwt

        now = int(datetime.now(UTC).timestamp())
        token = jwt.encode(
            {"sub": USER_ID, "aud": AUDIENCE, "iss": ISSUER, "iat": now, "exp": now + 3600},
            KEY._private,  # noqa: SLF001
            algorithm="ES256",
        )  # no kid header

        with pytest.raises(InvalidTokenError):
            get_unverified_kid(token)

    def test_rejects_disallowed_algorithm_early(self):
        """A non-ES256 header is refused before any key is fetched."""
        with pytest.raises(InvalidTokenError):
            get_unverified_kid(forge_unsigned(KEY, "none"))

    def test_rejects_unreadable_header(self):
        with pytest.raises(InvalidTokenError):
            get_unverified_kid("not-a-jwt")


# =============================================================================
# Postgres role is not an application role
# =============================================================================


class TestPostgresRoleConfusion:
    def test_role_claim_is_isolated(self):
        claims = decode(KEY.sign())

        assert claims.postgres_role == "authenticated"
        assert not hasattr(claims, "role")

    def test_forged_admin_role_confers_nothing(self):
        claims = decode(KEY.sign(role="admin"))

        assert claims.postgres_role == "admin"
        assert not hasattr(claims, "is_admin")


# =============================================================================
# Offline guarantee (requirement 4)
# =============================================================================


class TestOfflineDecode:
    def test_decode_makes_no_network_call(self, monkeypatch: pytest.MonkeyPatch):
        """decode_access_token verifies with no socket access whatsoever."""

        def no_network(*args: Any, **kwargs: Any) -> None:  # noqa: ARG001
            message = "network access attempted during token decode"
            raise AssertionError(message)

        monkeypatch.setattr(socket, "socket", no_network)
        monkeypatch.setattr(socket, "create_connection", no_network)

        assert decode(KEY.sign()).sub == UUID(USER_ID)


# =============================================================================
# Async orchestrator with an injected provider
# =============================================================================


class _FakeProvider:
    """Minimal in-memory PublicKeyProvider for the orchestrator tests."""

    def __init__(self, key: SigningKey) -> None:
        self._key = key
        self.calls: list[str] = []

    async def get_signing_key(self, kid: str):
        self.calls.append(kid)
        if kid != self._key.kid:
            raise InvalidTokenError("The provided authentication token is invalid or has expired.")
        return self._key.public_jwk()


class TestVerifyAccessToken:
    def test_conforms_to_the_provider_protocol(self):
        assert isinstance(_FakeProvider(KEY), PublicKeyProvider)

    async def test_resolves_key_then_verifies(self):
        provider = _FakeProvider(KEY)

        claims = await verify_access_token(
            KEY.sign(), key_provider=provider, audience=AUDIENCE, issuer=ISSUER
        )

        assert claims.sub == UUID(USER_ID)
        assert provider.calls == [KEY.kid]

    async def test_unknown_kid_is_rejected(self):
        provider = _FakeProvider(SigningKey("other-kid"))

        with pytest.raises(InvalidTokenError):
            await verify_access_token(
                KEY.sign(), key_provider=provider, audience=AUDIENCE, issuer=ISSUER
            )

    async def test_provider_outage_propagates(self):
        class DownProvider:
            async def get_signing_key(self, kid: str):  # noqa: ARG002
                raise ServiceUnavailableError("down")

        with pytest.raises(ServiceUnavailableError):
            await verify_access_token(
                KEY.sign(), key_provider=DownProvider(), audience=AUDIENCE, issuer=ISSUER
            )


# =============================================================================
# Bearer extraction
# =============================================================================


class TestBearerExtraction:
    def test_extracts_token(self):
        assert extract_bearer_token("Bearer abc.def.ghi") == "abc.def.ghi"

    @pytest.mark.parametrize("scheme", ["Bearer", "bearer", "BEARER", "BeArEr"])
    def test_scheme_is_case_insensitive(self, scheme: str):
        assert extract_bearer_token(f"{scheme} abc.def.ghi") == "abc.def.ghi"

    @pytest.mark.parametrize("header", [None, "", "   "])
    def test_missing_header_signals_login_required(self, header: str | None):
        with pytest.raises(AuthenticationError) as caught:
            extract_bearer_token(header)
        assert not isinstance(caught.value, InvalidTokenError)

    @pytest.mark.parametrize(
        "header", ["Basic abc", "Token abc", "abc.def.ghi", "Bearer", "Bearer  "]
    )
    def test_rejects_malformed_header(self, header: str):
        with pytest.raises(InvalidTokenError):
            extract_bearer_token(header)


# =============================================================================
# AuthenticatedUser
# =============================================================================


class TestAuthenticatedUser:
    def test_defaults_to_least_privilege(self):
        user = AuthenticatedUser(id=UUID(USER_ID))
        assert user.role is AppRole.USER
        assert user.is_admin is False

    def test_is_immutable(self):
        user = AuthenticatedUser(id=UUID(USER_ID), role=AppRole.USER)
        with pytest.raises(ValidationError):
            user.role = AppRole.ADMIN  # type: ignore[misc]

    def test_admin_recognised(self):
        assert AuthenticatedUser(id=UUID(USER_ID), role=AppRole.ADMIN).is_admin is True
