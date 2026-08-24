"""Model dependency provider (Phase G).

Hands request handlers the process-wide :class:`~app.domain.models.manager.ModelManager`
that the lifespan hook placed on ``app.state``. Mirrors
:mod:`app.dependencies.database`: a provider resolves and validates, holds no
business logic, and raises rather than returning ``None`` so a handler can trust
the dependency.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, Request

from app.core.exceptions import ModelNotLoadedError

if TYPE_CHECKING:
    from app.domain.models.manager import ModelManager

# Attribute name under which the lifespan hook stores the manager on app.state.
MODEL_MANAGER_STATE_ATTR = "model_manager"


def get_model_manager(request: Request) -> ModelManager:
    """Return the shared model manager.

    Args:
        request: The incoming request, used only to reach ``app.state``.

    Returns:
        The process-wide :class:`ModelManager`.

    Raises:
        ModelNotLoadedError: No manager exists on ``app.state`` - inference was
            not wired up at startup. Surfaces as a 503 in the standard envelope.
    """
    manager: ModelManager | None = getattr(request.app.state, MODEL_MANAGER_STATE_ATTR, None)
    if manager is None:
        raise ModelNotLoadedError("The AI model is not currently available.")
    return manager


ModelManagerDep = Annotated["ModelManager", Depends(get_model_manager)]
"""Injected model manager. Handlers annotate a parameter with this."""


def get_optional_model_manager(request: Request) -> ModelManager | None:
    """Return the shared model manager, or ``None`` when startup never set one.

    The non-raising counterpart to :func:`get_model_manager`. Inference
    handlers *want* the raise - a missing manager means they cannot do their
    job, and 503 is the honest answer. The health endpoints do not: reporting
    "the model is unavailable" **is** their job, and they must keep answering
    in the standard envelope rather than being short-circuited by an exception
    handler.

    Reads ``app.state`` only. It performs no I/O, never constructs or loads a
    backend, and never runs inference, so a readiness probe stays cheap enough
    to be called every few seconds by an orchestrator.

    Args:
        request: The incoming request, used only to reach ``app.state``.

    Returns:
        The process-wide :class:`ModelManager`, or ``None`` if the lifespan
        hook did not run or did not install one.
    """
    return getattr(request.app.state, MODEL_MANAGER_STATE_ATTR, None)


OptionalModelManagerDep = Annotated["ModelManager | None", Depends(get_optional_model_manager)]
"""Injected model manager that may legitimately be absent. Used by health checks."""
