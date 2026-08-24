"""Unit tests for the Supabase infrastructure client.

Offline throughout. ``acreate_client`` is patched so no real network client is
constructed: the tests assert *what the factory does* - the URL, key and options
it passes, and that the key never reaches a log - not that Supabase is reachable.
Real connectivity is a manual local step, documented in the README.
"""

from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.config import Settings
from app.core.exceptions import ConfigurationError, ServiceUnavailableError
from app.dependencies.database import SUPABASE_STATE_ATTR, get_supabase_client
from app.infra import supabase_client as module

pytestmark = pytest.mark.unit

REAL_URL = "https://projref.supabase.co"
SERVICE_KEY = "sb_secret_test_value_not_a_real_key"


def configured_settings(**overrides: Any) -> Settings:
    """Settings with the Supabase data plane configured."""
    base: dict[str, Any] = {
        "_env_file": None,
        "secret_key": "k" * 48,
        "supabase_url": REAL_URL,
        "supabase_service_role_key": SERVICE_KEY,
    }
    base.update(overrides)
    return Settings(**base)


class _CapturingClient:
    """Stand-in returned by the patched ``acreate_client``."""

    def __init__(self, url: str, key: str, options: Any) -> None:
        self.url = url
        self.key = key
        self.options = options


@pytest.fixture
def patched_acreate(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, Any]]:
    """Patch ``acreate_client`` to capture its arguments without networking."""
    calls: list[tuple[str, str, Any]] = []

    async def fake_acreate(url: str, key: str, options: Any) -> _CapturingClient:
        calls.append((url, key, options))
        return _CapturingClient(url, key, options)

    monkeypatch.setattr(module, "acreate_client", fake_acreate)
    return calls


class TestConfigGate:
    """`is_supabase_configured` under the asymmetric signing system."""

    def test_configured_needs_url_and_service_key_only(self):
        assert configured_settings().is_supabase_configured is True

    def test_not_configured_without_service_key(self):
        settings = Settings(_env_file=None, secret_key="k" * 48, supabase_url=REAL_URL)
        assert settings.is_supabase_configured is False

    def test_does_not_require_legacy_jwt_secret(self):
        """A missing (legacy, unused) JWT secret must not mark the DB unconfigured."""
        settings = configured_settings()
        assert settings.supabase_jwt_secret is None
        assert settings.is_supabase_configured is True


class TestCreateClient:
    async def test_builds_client_with_configured_credentials(
        self, patched_acreate: list[tuple[str, str, Any]]
    ):
        await module.create_supabase_client(configured_settings())

        assert len(patched_acreate) == 1
        url, key, options = patched_acreate[0]
        assert url == REAL_URL
        assert key == SERVICE_KEY

    async def test_uses_server_side_options(self, patched_acreate: list[tuple[str, str, Any]]):
        """A server client persists no session and never auto-refreshes."""
        await module.create_supabase_client(configured_settings())

        _, _, options = patched_acreate[0]
        assert options.persist_session is False
        assert options.auto_refresh_token is False
        assert options.schema == "public"

    async def test_unconfigured_raises_configuration_error(
        self, patched_acreate: list[tuple[str, str, Any]]
    ):
        settings = Settings(_env_file=None, secret_key="k" * 48)

        with pytest.raises(ConfigurationError):
            await module.create_supabase_client(settings)
        assert patched_acreate == [], "must not attempt to build a client"

    @pytest.mark.usefixtures("patched_acreate")
    async def test_service_role_key_is_never_logged(self, caplog: pytest.LogCaptureFixture):
        """The startup log names the host, never the key or full URL."""
        with caplog.at_level(logging.DEBUG):
            await module.create_supabase_client(configured_settings())

        combined = " ".join(record.getMessage() for record in caplog.records)
        assert SERVICE_KEY not in combined
        assert "projref.supabase.co" in combined  # host is fine to log


class TestCloseClient:
    async def test_closes_postgrest_session(self):
        closed = {"value": False}

        async def aclose() -> None:
            closed["value"] = True

        client = SimpleNamespace(postgrest=SimpleNamespace(aclose=aclose))
        await module.close_supabase_client(client)  # type: ignore[arg-type]

        assert closed["value"] is True

    async def test_close_is_safe_without_a_session(self):
        """Best-effort close never raises, even if the shape is unexpected."""
        await module.close_supabase_client(SimpleNamespace())  # type: ignore[arg-type]

    async def test_close_swallows_errors(self):
        """Shutdown must not propagate a cleanup failure."""

        async def boom() -> None:
            raise RuntimeError("connection already gone")

        client = SimpleNamespace(postgrest=SimpleNamespace(aclose=boom))
        await module.close_supabase_client(client)  # type: ignore[arg-type]  # no raise


class TestDependencyProvider:
    def test_returns_client_from_app_state(self):
        sentinel = object()
        app = SimpleNamespace(state=SimpleNamespace(**{SUPABASE_STATE_ATTR: sentinel}))
        request = SimpleNamespace(app=app)

        assert get_supabase_client(request) is sentinel  # type: ignore[arg-type]

    def test_raises_when_client_absent(self):
        app = SimpleNamespace(state=SimpleNamespace(**{SUPABASE_STATE_ATTR: None}))
        request = SimpleNamespace(app=app)

        with pytest.raises(ServiceUnavailableError):
            get_supabase_client(request)  # type: ignore[arg-type]

    def test_raises_when_state_attr_missing(self):
        app = SimpleNamespace(state=SimpleNamespace())
        request = SimpleNamespace(app=app)

        with pytest.raises(ServiceUnavailableError):
            get_supabase_client(request)  # type: ignore[arg-type]
