"""Supabase service-role client.

The backend's single door to Supabase PostgreSQL and Storage
(03_Backend_Architecture.md §10, §18). One client is created at application
startup and reused for the whole process; request handlers receive it through
dependency injection and never construct their own.

Service-role authority
----------------------
This client authenticates with the **service-role key**, which has full database
access and **bypasses Row Level Security**. That is deliberate - the backend is
the trusted enforcement point - but it means the security burden moves up a
layer: every query in the service layer must scope to the authenticated user
itself (``WHERE user_id = ...``). RLS is a second line of defence here, not the
first. The key is read from :class:`~app.core.config.Settings`, never hardcoded,
and never logged.

Why a singleton
--------------
The client holds pooled HTTP connections. Creating one per request would leak
connections and add latency to every call, and Coding Standards §28 forbids that
pattern outright. The instance lives on ``app.state`` (set in the lifespan hook)
and is handed out by :func:`app.dependencies.database.get_supabase_client`.

This module is infrastructure: it wraps an external system and contains no
business logic (§10). It exposes plain functions rather than a manager class -
lifecycle is owned by the application's lifespan, which is the natural place for
process-wide resources, so a wrapper object would add indirection without value.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from supabase import AsyncClient, acreate_client
from supabase.lib.client_options import AsyncClientOptions

from app.core.exceptions import ConfigurationError
from app.core.logging import get_logger

if TYPE_CHECKING:
    from app.core.config import Settings

logger = get_logger(__name__)


def _build_options() -> AsyncClientOptions:
    """Return client options tuned for trusted server-side use.

    Session persistence and token auto-refresh are the browser client's concern;
    a server holding a static service-role key needs neither, and disabling them
    avoids background refresh tasks that would otherwise run for the life of the
    process.

    Returns:
        Options with session persistence and auto-refresh disabled, pinned to
        the ``public`` schema.
    """
    return AsyncClientOptions(
        schema="public",
        auto_refresh_token=False,
        persist_session=False,
    )


async def create_supabase_client(settings: Settings) -> AsyncClient:
    """Create the Supabase service-role client.

    Called once, from the application lifespan. Constructing the client performs
    no network round-trip, so startup does not depend on the database being
    reachable at that instant.

    Args:
        settings: Validated application settings supplying the project URL and
            service-role key.

    Returns:
        A configured :class:`AsyncClient`.

    Raises:
        ConfigurationError: The Supabase data plane is not configured. Raised
            with the variable *names* only - the values are never echoed.
    """
    if not settings.is_supabase_configured:
        msg = (
            "Supabase is not configured: SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY must both be set."
        )
        raise ConfigurationError(msg)

    # Guaranteed non-None by the guard above; asserted for the type checker,
    # which cannot infer that from a computed property.
    url = settings.supabase_url
    key = settings.supabase_service_role_key
    if url is None or key is None:  # pragma: no cover - unreachable
        msg = "Supabase configuration became inconsistent."
        raise ConfigurationError(msg)

    client = await acreate_client(url, key, _build_options())

    # Log the host only. The service-role key must never appear in a log
    # (Coding Standards §13); even the full URL is more than an operator needs.
    logger.info("Supabase client initialised for project host %s", _host_of(url))
    return client


async def close_supabase_client(client: AsyncClient) -> None:
    """Release the client's pooled connections at shutdown.

    Best-effort: the async client exposes no single close method, so the
    underlying PostgREST session is closed directly when available. Failure to
    close is logged, never raised - shutdown must not error.

    Args:
        client: The client created by :func:`create_supabase_client`.
    """
    postgrest = getattr(client, "postgrest", None)
    aclose = getattr(postgrest, "aclose", None)
    if aclose is None:
        return
    try:
        await aclose()
        logger.info("Supabase client connections closed")
    except Exception:  # noqa: BLE001 - shutdown cleanup must never propagate
        logger.warning("Error while closing the Supabase client; ignoring during shutdown")


def _host_of(url: str) -> str:
    """Return the host portion of a URL, for safe logging.

    Args:
        url: The project URL.

    Returns:
        The host, or the raw string if it cannot be parsed.
    """
    from urllib.parse import urlparse

    return urlparse(url).netloc or url
