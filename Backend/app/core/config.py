"""Typed application configuration.

All configuration arrives through environment variables, validated once at
startup by Pydantic Settings (Coding Standards §14-§15). Nothing is read from
``os.environ`` anywhere else, and no secret is ever hardcoded.

Consume settings through dependency injection rather than importing the
singleton directly, so tests can override them::

    from fastapi import Depends
    from app.core.config import Settings, get_settings

    @router.get("/example")
    def example(settings: Settings = Depends(get_settings)) -> ...:
        ...

Phase D reads only the application and security sections. Supabase, SMTP and
WhatsApp settings are declared now but optional, so the service starts and
reports them honestly as ``not_configured`` until their phase wires them up.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import Field, ValidationError, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.constants import BYTES_PER_MB
from app.core.exceptions import ConfigurationError

# ``app/core/config.py`` -> parents[0]=core, [1]=app, [2]=Backend
BACKEND_ROOT: Path = Path(__file__).resolve().parents[2]
"""Absolute path to the Backend/ directory.

Relative paths in the environment are resolved against this rather than the
process working directory, so the service behaves identically whether uvicorn
is launched from Backend/, from the repository root, or from a container.
"""

ENV_FILE: Path = BACKEND_ROOT / ".env"

# Placeholder values shipped in .env.example. Startup fails if any survives into
# a real environment, so a forgotten copy-paste can never reach production.
_REJECTED_PLACEHOLDER_VALUES: frozenset[str] = frozenset(
    {
        "change-me-generate-a-random-48-byte-urlsafe-string",
        "your-service-role-key-here",
        "your-jwt-secret-here",
        "your-whatsapp-api-key-here",
        "your-app-password-here",
    }
)

_MIN_SECRET_KEY_LENGTH: int = 32


class Settings(BaseSettings):
    """Validated application settings, loaded from the environment.

    A missing ``.env`` file is not itself an error - in production, values come
    from platform secrets. A missing *required* value always is: Pydantic raises
    at import time with the offending variable named.
    """

    model_config = SettingsConfigDict(
        env_file=ENV_FILE if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # Application
    # -------------------------------------------------------------------------
    app_env: Literal["development", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    host: str = "127.0.0.1"
    port: Annotated[int, Field(ge=1, le=65535)] = 8000

    api_v1_prefix: str = "/api/v1"

    # -------------------------------------------------------------------------
    # Security
    # -------------------------------------------------------------------------
    # No default: this is the one value that makes a missing .env fail loudly,
    # satisfying the Phase D definition of done.
    secret_key: str

    # `NoDecode` is essential, not decorative. For a complex field type such as
    # list[str], pydantic-settings runs json.loads on the raw environment value
    # inside EnvSettingsSource - *before* any field validator is reached. Without
    # it, the plain comma-separated form documented in .env.example raises
    # SettingsError at startup and never reaches `_split_origins` below.
    allowed_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    # -------------------------------------------------------------------------
    # Supabase (Phases E & F)
    # -------------------------------------------------------------------------
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    # Legacy. Supabase migrated this project to asymmetric signing keys
    # (ES256/P-256), so token verification no longer uses a shared secret - it
    # fetches public keys from the JWKS endpoint. This field is retained only so
    # an old value in an existing .env does not raise "extra field"; it plays no
    # part in verification. Safe to delete from any environment.
    supabase_jwt_secret: str | None = None

    # -------------------------------------------------------------------------
    # Authentication (Phase E)
    # -------------------------------------------------------------------------
    # The signing algorithm is deliberately NOT configurable. Reading it from
    # the environment would let a misconfiguration - or an attacker with write
    # access to the deployment config - weaken verification to `none` or swap it
    # for an algorithm the attacker can forge. It is pinned as a constant beside
    # the verification code (app/core/security.py).
    jwt_audience: str = "authenticated"
    """Audience claim Supabase mints into user access tokens."""

    jwt_leeway_seconds: Annotated[int, Field(ge=0, le=300)] = 60
    """Clock-skew tolerance on `exp`/`iat`.

    Without it, a small drift between the backend host and Supabase rejects
    otherwise valid tokens intermittently - a failure mode that is painful to
    reproduce. Capped at 300s so it cannot be widened into a real exposure.
    """

    jwt_jwks_cache_ttl: Annotated[int, Field(ge=60, le=86400)] = 600
    """Seconds a fetched JWKS key set is considered fresh.

    Public keys rotate rarely, so a long TTL keeps verification effectively
    offline: after the first fetch, tokens are checked against cached keys with
    no network call. A token bearing an unrecognised `kid` triggers an
    out-of-band refresh regardless of this TTL, so rotation is picked up
    promptly rather than waiting for the cache to expire.
    """

    jwt_jwks_min_refresh_interval: Annotated[int, Field(ge=0, le=3600)] = 30
    """Minimum seconds between JWKS refetches.

    Rate-limits the refresh-on-unknown-`kid` path so a flood of tokens carrying
    bogus key ids cannot be turned into a denial-of-service against the JWKS
    endpoint. Within this window an unknown `kid` is simply rejected.
    """

    auth_role_cache_ttl: Annotated[int, Field(ge=0, le=3600)] = 60
    """Seconds to cache a user's role lookup (decision E-D3).

    Roles live in `public.user_roles`, so an uncached check costs a database
    round-trip on every admin request. The trade-off is bounded staleness: a
    demoted administrator keeps access for at most this long. Set to 0 to
    disable caching and make revocation immediate.
    """

    # -------------------------------------------------------------------------
    # AI model (Phase G)
    # -------------------------------------------------------------------------
    model_path: Path = Path("../ML/checkpoints/tuned_fixed/best.onnx")
    model_device: str = "auto"
    model_score_threshold: Annotated[float, Field(ge=0.0, le=1.0)] = 0.5

    # Offline evaluation metrics (precision/recall/mAP/confusion matrix) from
    # the held-out test set - genuinely measured, not something a live
    # inference API can recompute per request. Served by the Analytics
    # endpoint's "AI performance" card.
    model_metrics_path: Path = Path("../ML/results/test_metrics_tuned.json")

    # Directory the admin "switch active model" feature scans for candidate
    # checkpoints (Phase K+). A sibling of `model_path`, not a subdirectory of
    # it - `model_path` may point at `.../checkpoints/tuned/best.pth` while
    # this is `.../checkpoints`, the common ancestor of every trained run.
    model_checkpoints_dir: Path = Path("../ML/checkpoints")

    # -------------------------------------------------------------------------
    # Upload limits (Phase G)
    # -------------------------------------------------------------------------
    max_image_size_mb: Annotated[int, Field(gt=0)] = 25
    max_video_size_mb: Annotated[int, Field(gt=0)] = 500

    # -------------------------------------------------------------------------
    # Notifications (Phase J)
    # -------------------------------------------------------------------------
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_name: str = "DriveAlert"

    whatsapp_api_key: str | None = None

    # =========================================================================
    # Validators
    # =========================================================================

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: Any) -> Any:
        """Parse ``ALLOWED_ORIGINS`` from either supported textual form.

        Because the field is annotated ``NoDecode``, this validator receives the
        raw environment string and owns all parsing. Two forms are accepted:

        * comma-separated - ``http://a.com,http://b.com`` (documented in
          ``.env.example``)
        * JSON array - ``["http://a.com","http://b.com"]`` (the pydantic-settings
          convention, which someone will reasonably try)

        Handling both matters: splitting a JSON array on commas succeeds and
        yields origins like ``["http://a.com``, which never match a real Origin
        header. The result is a total CORS failure with no error anywhere -
        far harder to diagnose than a rejected value.

        Args:
            value: Raw value from the environment, or a caller-supplied list.

        Returns:
            A list of trimmed, non-empty origin strings.
        """
        if not isinstance(value, str):
            return value

        text = value.strip()
        if text.startswith("["):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as error:
                msg = f"ALLOWED_ORIGINS looks like JSON but could not be parsed: {error.msg}"
                raise ValueError(msg) from error
            if not isinstance(parsed, list):
                msg = "ALLOWED_ORIGINS JSON form must be an array of strings."
                raise ValueError(msg)
            return [str(origin).strip() for origin in parsed if str(origin).strip()]

        return [origin.strip() for origin in text.split(",") if origin.strip()]

    @field_validator("secret_key")
    @classmethod
    def _validate_secret_key(cls, value: str) -> str:
        """Reject placeholder or trivially short signing keys.

        Args:
            value: The configured ``SECRET_KEY``.

        Returns:
            The validated key.

        Raises:
            ValueError: If the key is a known placeholder or too short. The
                message never echoes the value itself.
        """
        if value in _REJECTED_PLACEHOLDER_VALUES:
            msg = (
                "SECRET_KEY is still set to the placeholder from .env.example. "
                'Generate one with: python -c "import secrets; '
                'print(secrets.token_urlsafe(48))"'
            )
            raise ValueError(msg)
        if len(value) < _MIN_SECRET_KEY_LENGTH:
            msg = f"SECRET_KEY must be at least {_MIN_SECRET_KEY_LENGTH} characters long."
            raise ValueError(msg)
        return value

    @field_validator(
        "supabase_service_role_key",
        "supabase_jwt_secret",
        "whatsapp_api_key",
        "smtp_password",
    )
    @classmethod
    def _reject_placeholder_secrets(cls, value: str | None) -> str | None:
        """Treat an unedited placeholder as absent rather than as a real credential.

        Leaving the placeholder in place would make the readiness endpoint claim
        a dependency is configured when it is not, and would surface as a
        confusing authentication failure later.

        Args:
            value: The configured credential, if any.

        Returns:
            The credential, or ``None`` when it is an unedited placeholder.
        """
        if value is not None and value.strip() in _REJECTED_PLACEHOLDER_VALUES:
            return None
        return value

    @field_validator("supabase_url")
    @classmethod
    def _normalise_supabase_url(cls, value: str | None) -> str | None:
        """Strip any trailing slash from the project URL.

        The issuer claim is built by appending ``/auth/v1``. A configured value
        ending in ``/`` would produce ``https://ref.supabase.co//auth/v1``, which
        does not string-equal the ``iss`` Supabase actually mints - every token
        would be rejected, for a reason that is invisible in the config file.

        Args:
            value: Configured project URL, if any.

        Returns:
            The URL without a trailing slash, or ``None``.
        """
        if value is None:
            return None
        return value.strip().rstrip("/") or None

    @field_validator("model_path", "model_metrics_path", "model_checkpoints_dir")
    @classmethod
    def _resolve_model_path(cls, value: Path) -> Path:
        """Resolve a relative model-related path against the Backend directory.

        The configured defaults point outside the backend tree, at files
        shipped with the training code (decision C3 - the 128 MB weights, and
        the evaluation metrics alongside them, are not duplicated). Anchoring
        to :data:`BACKEND_ROOT` keeps that correct regardless of the process
        working directory.

        Args:
            value: Configured path, absolute or relative.

        Returns:
            An absolute, normalised path. Existence is *not* checked here -
            each consumer verifies it lazily, at load time, so Phase D can
            start without either file present.
        """
        if value.is_absolute():
            return value
        return (BACKEND_ROOT / value).resolve()

    @field_validator("api_v1_prefix")
    @classmethod
    def _normalise_prefix(cls, value: str) -> str:
        """Ensure the API prefix has a leading slash and no trailing slash.

        Args:
            value: Configured prefix, e.g. ``"api/v1/"``.

        Returns:
            A normalised prefix, e.g. ``"/api/v1"``.
        """
        return "/" + value.strip("/")

    @model_validator(mode="after")
    def _enforce_production_constraints(self) -> Settings:
        """Apply the stricter rules that only make sense in production.

        Development is deliberately permissive; production is not. Deployment
        §18 requires an explicit CORS allowlist, and a wildcard origin combined
        with credentialed requests would let any site call the API on behalf of
        a signed-in user.

        Returns:
            The validated settings instance.

        Raises:
            ValueError: If a production deployment is unsafely configured.
        """
        if self.app_env != "production":
            return self

        if not self.allowed_origins:
            msg = "ALLOWED_ORIGINS must be set explicitly when APP_ENV=production."
            raise ValueError(msg)
        if "*" in self.allowed_origins:
            msg = "ALLOWED_ORIGINS must not contain '*' when APP_ENV=production."
            raise ValueError(msg)
        return self

    # =========================================================================
    # Derived values
    # =========================================================================

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        """Whether the application is running in the production environment."""
        return self.app_env == "production"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_supabase_configured(self) -> bool:
        """Whether the Supabase *data plane* (database and storage) can be reached.

        Requires the project URL and the service-role key, and nothing else. It
        deliberately no longer checks ``supabase_jwt_secret``: under the
        asymmetric signing system that value is legacy and unused, so requiring
        it would report the database as unconfigured on a deployment that is in
        fact fully able to reach it.
        """
        return bool(self.supabase_url and self.supabase_service_role_key)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_smtp_configured(self) -> bool:
        """Whether email delivery has enough configuration to be attempted."""
        return all((self.smtp_host, self.smtp_user, self.smtp_password))

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_jwt_verification_configured(self) -> bool:
        """Whether incoming access tokens can be verified.

        Deliberately narrower than :attr:`is_supabase_configured`. Under the
        asymmetric signing system, verification needs only the project URL: the
        public keys come from the JWKS endpoint derived from it, and no secret
        is involved at all. It does not need the service-role key. Keeping the
        checks separate means a deployment missing only the database credential
        can still authenticate users and return an honest 503 for data access,
        rather than rejecting everyone as unauthenticated.
        """
        return bool(self.supabase_url)

    @property
    def supabase_issuer(self) -> str | None:
        """Expected ``iss`` claim for user access tokens.

        Supabase mints ``https://<project-ref>.supabase.co/auth/v1``. Verifying
        it is what stops a token from a *different* Supabase project from being
        accepted here, even though its signature is valid under that project's
        own keys.

        Returns:
            The issuer URL, or ``None`` when ``SUPABASE_URL`` is unset.
        """
        if self.supabase_url is None:
            return None
        return f"{self.supabase_url}/auth/v1"

    @property
    def supabase_jwks_url(self) -> str | None:
        """URL of the JWKS endpoint publishing the token-signing public keys.

        Supabase serves the key set at ``<issuer>/.well-known/jwks.json``. This
        endpoint is public - it contains only public keys - so fetching it needs
        no credential.

        Returns:
            The JWKS URL, or ``None`` when ``SUPABASE_URL`` is unset.
        """
        if self.supabase_issuer is None:
            return None
        return f"{self.supabase_issuer}/.well-known/jwks.json"

    @property
    def max_image_size_bytes(self) -> int:
        """Maximum accepted image upload, in bytes."""
        return self.max_image_size_mb * BYTES_PER_MB

    @property
    def max_video_size_bytes(self) -> int:
        """Maximum accepted video upload, in bytes."""
        return self.max_video_size_mb * BYTES_PER_MB


def _format_validation_failure(error: ValidationError) -> str:
    """Turn a Pydantic validation failure into actionable operator guidance.

    Pydantic reports ``secret_key / Field required``, which names the field but
    does not say where it should come from. At startup that is the difference
    between a one-minute fix and a confusing stack trace.

    Args:
        error: The validation error raised while building :class:`Settings`.

    Returns:
        A multi-line message naming each offending environment variable.
    """
    lines = ["Invalid backend configuration:", ""]
    for detail in error.errors():
        variable = str(detail["loc"][0]).upper() if detail["loc"] else "(unknown)"
        lines.append(f"  - {variable}: {detail['msg']}")

    env_hint = (
        f"Expected an .env file at: {ENV_FILE}"
        if not ENV_FILE.exists()
        else f"Loaded .env from: {ENV_FILE}"
    )
    lines += [
        "",
        env_hint,
        "Create one with:  copy .env.example .env",
        "then fill in the required values.",
    ]
    return "\n".join(lines)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached application settings.

    Cached so the environment is parsed and validated exactly once per process.
    Use as a FastAPI dependency; tests override it via
    ``app.dependency_overrides[get_settings]`` and call
    ``get_settings.cache_clear()`` between cases.

    Returns:
        The validated :class:`Settings` singleton.

    Raises:
        ConfigurationError: If any required variable is missing or invalid.
            Raised at startup, so the service fails fast rather than serving
            traffic in a half-configured state.
    """
    try:
        return Settings()  # type: ignore[call-arg]  # values come from the environment
    except ValidationError as error:
        raise ConfigurationError(_format_validation_failure(error)) from error
