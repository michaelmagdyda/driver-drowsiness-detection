"""ES256 key and token helpers for the authentication unit tests.

Builds real P-256 keypairs and signs real tokens, so the verification path is
exercised against genuine ECDSA signatures rather than mocks. A test support
module, not a test itself.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from jwt import PyJWK
from jwt.algorithms import ECAlgorithm

AUDIENCE = "authenticated"
ISSUER = "https://testref.supabase.co/auth/v1"
USER_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"


class SigningKey:
    """A P-256 keypair with helpers to sign tokens and export its public JWK."""

    def __init__(self, kid: str) -> None:
        """Generate a fresh keypair tagged with ``kid``."""
        self.kid = kid
        self._private = ec.generate_private_key(ec.SECP256R1())

    @property
    def public_pem(self) -> bytes:
        """The public key in PEM form, as an attacker would obtain it."""
        return self._private.public_key().public_bytes(
            Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
        )

    def jwk_dict(self) -> dict[str, Any]:
        """Export the public key as a JWKS entry (kid, alg, use populated)."""
        raw = json.loads(ECAlgorithm(ECAlgorithm.SHA256).to_jwk(self._private.public_key()))
        raw.update(kid=self.kid, alg="ES256", use="sig")
        return raw

    def public_jwk(self) -> PyJWK:
        """The public key as a :class:`PyJWK`, ready for verification."""
        return PyJWK.from_dict(self.jwk_dict())

    def sign(self, **claim_overrides: Any) -> str:
        """Sign a realistic Supabase access token with this key's ``kid``."""
        now = int(time.time())
        claims: dict[str, Any] = {
            "sub": USER_ID,
            "email": "driver@example.com",
            "aud": AUDIENCE,
            "iss": ISSUER,
            "iat": now,
            "exp": now + 3600,
            "role": "authenticated",
            "session_id": "sess-1234",
            "app_metadata": {"provider": "email"},
            "user_metadata": {"display_name": "Test Driver"},
        }
        claims.update(claim_overrides)
        return jwt.encode(claims, self._private, algorithm="ES256", headers={"kid": self.kid})


def _b64(raw: bytes) -> str:
    """Base64url without padding, as JWT segments require."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def forge_hs256_with_public_key(key: SigningKey, **claim_overrides: Any) -> str:
    """Hand-build the ES-to-HS confusion forgery.

    Signs an HS256 token using the victim's PUBLIC key bytes as the HMAC secret -
    the canonical asymmetric key-confusion attack. Built by hand because PyJWT
    refuses to encode HMAC with an asymmetric key, which is exactly the mistake
    an attacker exploits on a naive verifier.
    """
    now = int(time.time())
    claims = {
        "sub": "attacker",
        "aud": AUDIENCE,
        "iss": ISSUER,
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(claim_overrides)
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT", "kid": key.kid}).encode())
    payload = _b64(json.dumps(claims).encode())
    signing_input = f"{header}.{payload}".encode()
    signature = _b64(hmac.new(key.public_pem, signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def forge_unsigned(key: SigningKey, algorithm: str = "none") -> str:
    """Hand-build an ``alg=none`` token with an empty signature."""
    now = int(time.time())
    claims = {
        "sub": USER_ID,
        "aud": AUDIENCE,
        "iss": ISSUER,
        "iat": now,
        "exp": now + 3600,
    }
    header = _b64(json.dumps({"alg": algorithm, "typ": "JWT", "kid": key.kid}).encode())
    payload = _b64(json.dumps(claims).encode())
    return f"{header}.{payload}."
