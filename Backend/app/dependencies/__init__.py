"""Dependencies layer - FastAPI dependency-injection providers.

Placeholder. Populated in Phase E (03_Backend_Architecture.md §14,
Coding Standards §11).

Purpose
-------
Everything a route needs but does not construct itself arrives through
``Depends``. Centralising the providers here means a route declares *what* it
needs, never *how* to build it - and a test swaps any of them through
``app.dependency_overrides`` without patching a module global.

The one provider that already exists, :func:`app.core.config.get_settings`,
lives in ``core`` because configuration sits below every other layer. Providers
that depend on infrastructure or services belong here instead.

Planned contents
----------------
Phase E - authentication and authorisation
    ``get_current_user``
        Verifies the Supabase JWT on the ``Authorization`` header and returns
        the authenticated principal. Raises
        :class:`~app.core.exceptions.InvalidTokenError` on failure.
    ``get_optional_user``
        As above but tolerates an absent token, for endpoints that serve guests
        differently rather than rejecting them.
    ``require_admin``
        Asserts the ``admin`` role. The frontend's ``/admin`` route has no role
        gate of its own - only the ``_authenticated`` check - so this is the
        sole enforcement point for administrator access.

Phase F - persistence
    ``get_supabase_client``
        Supplies the service-role client from the infrastructure layer.

Phase G - inference
    ``get_model_manager``
        Returns the ``ModelManager`` held on ``app.state``, loaded once during
        ``lifespan``. Routes never touch the model directly (§16).

Rules
-----
* Providers resolve and validate; they hold no business logic. A dependency that
  starts making decisions belongs in a service.
* No module-level mutable state (Coding Standards §28). Shared objects live on
  ``app.state`` and are read through a provider.
"""
