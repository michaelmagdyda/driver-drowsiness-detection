"""Database dependency providers.

Hands request handlers the process-wide Supabase client that the lifespan hook
placed on ``app.state`` (Coding Standards §11, §14). Handlers depend on this
provider rather than constructing a client, which is what keeps a single pooled
client shared across the whole application.

A provider resolves and validates; it holds no business logic. If the client is
absent - Supabase was not configured at startup - it raises a 503 rather than
returning ``None``, so a handler can annotate the dependency as non-optional and
trust it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, Request

from app.core.exceptions import ServiceUnavailableError

if TYPE_CHECKING:
    from supabase import AsyncClient

# Attribute name under which the lifespan hook stores the client on app.state.
SUPABASE_STATE_ATTR = "supabase_client"


def get_supabase_client(request: Request) -> AsyncClient:
    """Return the shared Supabase client.

    Args:
        request: The incoming request, used only to reach ``app.state``.

    Returns:
        The process-wide :class:`AsyncClient`.

    Raises:
        ServiceUnavailableError: Supabase was not configured at startup, so no
            client exists. Surfaces as a 503 in the standard envelope - an honest
            "the database is unavailable" rather than a confusing internal error.
    """
    client: AsyncClient | None = getattr(request.app.state, SUPABASE_STATE_ATTR, None)
    if client is None:
        msg = "The database is not available."
        raise ServiceUnavailableError(msg)
    return client


SupabaseClientDep = Annotated["AsyncClient", Depends(get_supabase_client)]
"""Injected Supabase client. Handlers annotate a parameter with this."""
