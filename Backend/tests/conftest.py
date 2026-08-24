"""Shared pytest fixtures.

Two problems have to be solved before a single test can run, and both are
solved here rather than in individual test modules.

**1. The suite must not read the developer's ``.env``.**
A test that passes on one machine and fails on another because of a local
configuration file is worse than no test. Every fixture builds
:class:`~app.core.config.Settings` with ``_env_file=None``, so configuration is
explicit and identical everywhere, including CI.

**2. ``app.main`` builds an application at import time.**
The module-level ``app = create_app()`` validates configuration as a side effect
of being imported. With no ``.env`` present that raises
:class:`~app.core.exceptions.ConfigurationError` during collection, before any
test runs. The ``os.environ`` defaults below are set at conftest import - which
pytest performs before importing any test module - so that import always
succeeds. Application imports are deferred into the fixtures themselves, so
nothing from ``app`` is imported until the environment is safe.

Environment variables set here take precedence over a ``.env`` file in
pydantic-settings' source ordering, so a developer with ``APP_ENV=production``
locally still gets a development test run.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any

import pytest
from pydantic import BaseModel

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

    from fastapi.testclient import TestClient

    from app.core.config import Settings

# Must run before anything under `app` is imported anywhere in the suite.
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("LOG_LEVEL", "WARNING")
os.environ.setdefault("SECRET_KEY", "test-only-secret-key-0123456789abcdefghijklmnop")
os.environ.setdefault("ALLOWED_ORIGINS", "http://testserver")

# noqa S105: a fixed in-process test value, never a real credential. Suppressed
# per-line rather than by adding S105 to the tests per-file-ignores, which would
# stop the check catching an actual key pasted into a test.
TEST_SECRET_KEY = "test-only-secret-key-0123456789abcdefghijklmnop"  # noqa: S105
"""Not a credential. Long enough to satisfy validation, used only in-process."""

TEST_ORIGIN = "http://testserver"
"""Origin TestClient sends, so CORS behaviour is exercisable."""


class Credentials(BaseModel):
    """Body used to prove submitted values never reach an error response.

    Declared at module level, not inside the fixture that uses it. This module
    enables ``from __future__ import annotations``, so route annotations reach
    FastAPI as strings and are resolved against the *module* namespace. A model
    defined in a function-local scope cannot be found there, and FastAPI
    silently falls back to treating the parameter as a query argument - the
    request body is then never validated at all.
    """

    email: str
    password: str


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    """Build hermetic settings for the suite.

    ``_env_file=None`` detaches this from any ``.env`` on disk. Session-scoped
    because the values are immutable and constructing them is not free.

    Returns:
        Settings with no dependency on the local filesystem or environment.
    """
    from app.core.config import Settings

    return Settings(
        _env_file=None,
        app_env="development",
        log_level="WARNING",
        secret_key=TEST_SECRET_KEY,
        allowed_origins=[TEST_ORIGIN],
    )


@pytest.fixture
def make_client(
    test_settings: Settings,
) -> Iterator[Callable[..., TestClient]]:
    """Return a factory that builds a client over customised settings.

    Use when a test needs configuration different from the default - a missing
    model checkpoint, or Supabase credentials present::

        client = make_client(model_path=Path("/nonexistent.pth"))

    Overrides are applied with ``model_copy``, which bypasses validation. That
    is intentional: it lets a test construct states that validators would
    normally reject, such as a checkpoint path that does not exist.

    Args:
        test_settings: Baseline settings for the suite.

    Yields:
        A factory taking keyword overrides and returning a ready
        :class:`TestClient`. Every client it creates is closed on teardown.
    """
    from fastapi.testclient import TestClient

    from app.core.config import get_settings
    from app.main import create_app

    created: list[TestClient] = []

    def _make(**overrides: Any) -> TestClient:
        settings = test_settings.model_copy(update=overrides) if overrides else test_settings
        application = create_app(settings)

        # create_app() passes settings to CORS and routing, but the routes
        # themselves resolve Depends(get_settings) - which returns the cached
        # process-wide singleton. Without this override the endpoints would read
        # the developer's real configuration while the app was built from ours.
        application.dependency_overrides[get_settings] = lambda: settings

        # raise_server_exceptions=False keeps the 500 path assertable: the point
        # is to verify what the *client* receives, not to see the traceback.
        # Tests assert exact status codes, so nothing is silently swallowed.
        client = TestClient(application, raise_server_exceptions=False)
        created.append(client)
        return client

    yield _make

    for client in created:
        client.close()


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> Iterator[TestClient]:
    """Return a client over the default test settings.

    Entered as a context manager so the ``lifespan`` hook runs - which means
    startup and shutdown are themselves covered by every test that uses this.

    Args:
        make_client: Client factory.

    Yields:
        A :class:`TestClient` with lifespan active.
    """
    with make_client() as active_client:
        yield active_client


@pytest.fixture
def error_client(make_client: Callable[..., TestClient]) -> Iterator[TestClient]:
    """Return a client whose app exposes deliberately failing routes.

    The exception handlers cannot be tested against the real API, because no
    Phase D endpoint fails on purpose. These routes exist only inside this
    fixture's application instance and are never mounted on the real one.

    Args:
        make_client: Client factory.

    Yields:
        A client whose app serves ``/__boom``, ``/__missing`` and ``/__echo``.
    """
    from app.core.exceptions import ModelNotLoadedError, SessionNotFoundError

    built = make_client()
    application = built.app

    @application.get("/__boom")
    async def _boom() -> None:
        """Raise an unhandled error carrying secret-looking text."""
        msg = "connection failed: postgres://admin:hunter2@10.0.0.5/prod"
        raise RuntimeError(msg)

    @application.get("/__missing")
    async def _missing() -> None:
        """Raise a 404-mapped application error."""
        raise SessionNotFoundError("sess-abc-123")

    @application.get("/__unavailable")
    async def _unavailable() -> None:
        """Raise a 503-mapped application error."""
        raise ModelNotLoadedError

    @application.post("/__echo")
    async def _echo(credentials: Credentials) -> dict[str, str]:
        """Accept credentials so validation failures can be inspected."""
        return {"email": credentials.email}

    with built as active_client:
        yield active_client
