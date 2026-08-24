"""Health, readiness and system status endpoints.

Implements the three checks in the API Specification §19 and Deployment §19.

Why three, and not one:

``GET /health``
    Liveness. Answers "is the process alive?" using only in-memory values, so
    it cannot be made slow or made to fail by a struggling dependency. An
    orchestrator restarts the container when this fails; a database blip - or a
    model that failed to load - must not trigger a restart loop.

``GET /ready``
    Readiness. Answers "can this process serve traffic right now?" by
    inspecting every dependency, including the real state of the process-wide
    :class:`~app.domain.models.manager.ModelManager`. A load balancer stops
    routing when this fails.

``GET /system/health``
    Operator summary in the exact shape fixed by the specification, rendered on
    the admin panel.

**Readiness reports HTTP status, not just a JSON field.** An orchestrator's
readinessProbe reads the status code and nothing else. Returning 200 with
``{"ready": false}`` would look correct to a human and be silently useless to
Kubernetes, so a not-ready result is a 503. The body still carries the full
``ReadinessData`` payload for humans and dashboards.
"""

from __future__ import annotations

from datetime import UTC, datetime
from http import HTTPStatus
from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, Depends, Response

from app import __version__
from app.core.config import Settings, get_settings
from app.core.constants import ModelStatus, ServiceStatus
from app.dependencies.model import OptionalModelManagerDep
from app.schemas.common import ApiResponse
from app.schemas.health import (
    DependencyStatus,
    HealthData,
    ReadinessData,
    SystemHealthData,
)

if TYPE_CHECKING:
    from app.domain.models.manager import ModelManager

router = APIRouter(tags=["Health"])

SettingsDep = Annotated[Settings, Depends(get_settings)]
"""Injected settings. Declared once so every route reads identically."""

MODEL_DEPENDENCY_NAME = "ai_model"
"""Name of the model entry in the readiness dependency list."""


# =============================================================================
# Dependency inspection
# =============================================================================
# Pure functions of already-resolved inputs: Settings, and the ModelManager
# that the lifespan hook installed on app.state. Nothing here performs I/O.
#
# In particular, none of these functions constructs a backend, calls load(), or
# runs a forward pass. A readiness probe is called every few seconds for the
# life of the pod; making it do real work would turn the health check into the
# thing that makes the service unhealthy.
# =============================================================================


# Maps the manager's own vocabulary onto the health endpoints'. Kept as data
# rather than an if-chain so an added ModelStatus member fails visibly here
# (falling through to "unavailable") instead of being silently treated as ready.
_MODEL_DEPENDENCY_STATE: dict[ModelStatus, tuple[ServiceStatus, str | None]] = {
    ModelStatus.LOADED: (ServiceStatus.ONLINE, None),
    # Transient, and still not servable. DEGRADED rather than OFFLINE so an
    # operator can tell "starting up" apart from "broken" at a glance.
    ModelStatus.LOADING: (ServiceStatus.DEGRADED, "AI model is still loading."),
    ModelStatus.NOT_LOADED: (ServiceStatus.OFFLINE, "AI model has not been loaded."),
    ModelStatus.FAILED: (ServiceStatus.OFFLINE, "AI model failed to load."),
}

_MODEL_UNAVAILABLE: tuple[ServiceStatus, str] = (
    ServiceStatus.OFFLINE,
    "AI model is unavailable.",
)
"""Used when no manager exists at all, and as the fallback for an unknown status."""


def _database_status(settings: Settings) -> DependencyStatus:
    """Report the Supabase PostgreSQL dependency.

    Reports what is *configured*, deliberately - it does not open a connection.
    A readiness probe that made a remote round-trip on every call would add
    latency to a hot path and let a Supabase hiccup pull every replica out of
    the load balancer at once.

    Args:
        settings: Validated application settings.

    Returns:
        Current status.
    """
    configured = settings.is_supabase_configured
    return DependencyStatus(
        name="database",
        status=ServiceStatus.ONLINE if configured else ServiceStatus.NOT_CONFIGURED,
        detail=None if configured else "Supabase credentials are not configured.",
    )


def _storage_status(settings: Settings) -> DependencyStatus:
    """Report the Supabase Storage dependency.

    Shares the Supabase credentials with the database, so it cannot be
    configured independently.

    Args:
        settings: Validated application settings.

    Returns:
        Current status.
    """
    configured = settings.is_supabase_configured
    return DependencyStatus(
        name="storage",
        status=ServiceStatus.ONLINE if configured else ServiceStatus.NOT_CONFIGURED,
        detail=None if configured else "Supabase credentials are not configured.",
    )


def _model_status(manager: ModelManager | None) -> DependencyStatus:
    """Report the AI model dependency from the live manager state.

    Reads :attr:`ModelManager.status` - the same value the inference path
    checks - so readiness cannot disagree with what an inference request would
    actually do. The previous implementation only tested whether the checkpoint
    file existed, which reported a serviceable model on a process whose load
    had failed.

    Args:
        manager: The process-wide manager, or ``None`` when startup never
            installed one.

    Returns:
        Current status. ``detail`` is a fixed, non-identifying string: it never
        contains the checkpoint path (Frontend Integration §11 lists the model
        path as a value the frontend must not see), a credential, or an
        exception message.
    """
    if manager is None:
        status, detail = _MODEL_UNAVAILABLE
    else:
        status, detail = _MODEL_DEPENDENCY_STATE.get(manager.status, _MODEL_UNAVAILABLE)

    return DependencyStatus(name=MODEL_DEPENDENCY_NAME, status=status, detail=detail)


def _collect_dependencies(
    settings: Settings, manager: ModelManager | None
) -> list[DependencyStatus]:
    """Gather the status of every external dependency.

    Args:
        settings: Validated application settings.
        manager: The process-wide model manager, if one exists.

    Returns:
        One entry per dependency, in a stable order.
    """
    return [
        _database_status(settings),
        _storage_status(settings),
        _model_status(manager),
    ]


def _is_ready(dependencies: list[DependencyStatus]) -> bool:
    """Decide whether the service should receive traffic.

    Two different rules, because the dependencies are not equivalent:

    *   **Supabase** may be ``NOT_CONFIGURED`` without blocking readiness. A
        deployment without database credentials still serves anonymous image
        analysis, and treating "deliberately absent" as "broken" would make the
        probe cry wolf.
    *   **The model must be positively ``ONLINE``.** Serving inference is what
        this process exists for. Anything short of loaded - not loaded yet,
        still loading, failed, or no manager at all - means requests would get
        a 503, so the pod must not be in the load balancer.

    Args:
        dependencies: Collected dependency statuses.

    Returns:
        ``True`` only when the model is loaded and nothing else is failing.
    """
    for dependency in dependencies:
        if dependency.status is ServiceStatus.OFFLINE:
            return False
        if (
            dependency.name == MODEL_DEPENDENCY_NAME
            and dependency.status is not ServiceStatus.ONLINE
        ):
            return False
    return True


# =============================================================================
# Routes
# =============================================================================


@router.get(
    "/health",
    summary="Health Check",
    description=(
        "Liveness probe. Returns 200 whenever the process can serve a request. "
        "Performs no I/O and never contacts a dependency, so it stays fast and "
        "stable regardless of database or model state - including when the AI "
        "model has failed to load."
    ),
    response_model=ApiResponse[HealthData],
)
async def health_check(settings: SettingsDep) -> ApiResponse[HealthData]:
    """Report process liveness.

    Deliberately takes no model or database dependency. If this endpoint could
    fail because the model failed, an orchestrator would restart the container
    in a loop over a problem a restart cannot fix.

    Args:
        settings: Injected application settings.

    Returns:
        The standard envelope wrapping :class:`HealthData`.
    """
    return ApiResponse.ok(
        HealthData(
            version=__version__,
            environment=settings.app_env,
            timestamp=datetime.now(UTC),
        ),
        message="Service is healthy.",
    )


@router.get(
    "/ready",
    summary="Readiness Check",
    description=(
        "Readiness probe. Returns 200 only when the service can serve inference "
        "traffic - which requires the AI model to be loaded - and 503 otherwise. "
        "The body carries per-dependency detail in both cases. Supabase "
        "credentials being absent reports `not_configured` and does not block "
        "readiness; the model not being loaded does."
    ),
    response_model=ApiResponse[ReadinessData],
    responses={
        HTTPStatus.SERVICE_UNAVAILABLE: {
            "description": "The service cannot serve traffic; see `data.dependencies`.",
            "model": ApiResponse[ReadinessData],
        }
    },
)
async def readiness_check(
    settings: SettingsDep,
    manager: OptionalModelManagerDep,
    response: Response,
) -> ApiResponse[ReadinessData]:
    """Report whether every dependency is in a serviceable state.

    Reads the live :class:`ModelManager` from ``app.state`` through a
    non-raising provider. It does not build, load or reload a model, and it
    does not run inference - the model is loaded exactly once, in the lifespan
    hook, and this only observes the result.

    The ``success`` envelope field stays ``True`` even on a 503: the readiness
    *query* succeeded, and the answer it returns is "not ready". Callers read
    the HTTP status or ``data.ready``, both of which agree.

    Args:
        settings: Injected application settings.
        manager: The process-wide model manager, or ``None`` if absent.
        response: Injected so a not-ready result can set 503 while still
            returning the full payload.

    Returns:
        The standard envelope wrapping :class:`ReadinessData`.
    """
    dependencies = _collect_dependencies(settings, manager)
    ready = _is_ready(dependencies)

    if not ready:
        response.status_code = HTTPStatus.SERVICE_UNAVAILABLE

    return ApiResponse.ok(
        ReadinessData(ready=ready, dependencies=dependencies),
        message="Service is ready." if ready else "Service is not ready.",
    )


@router.get(
    "/system/health",
    summary="System Health",
    description=(
        "Operator-facing summary of backend, database, storage and AI model "
        "state, in the shape defined by the API Specification section 19. "
        "Rendered on the administrator panel."
    ),
    response_model=ApiResponse[SystemHealthData],
)
async def system_health(
    settings: SettingsDep,
    manager: OptionalModelManagerDep,
) -> ApiResponse[SystemHealthData]:
    """Summarise the state of every major subsystem.

    Args:
        settings: Injected application settings.
        manager: The process-wide model manager, or ``None`` if absent.

    Returns:
        The standard envelope wrapping :class:`SystemHealthData`.
    """
    supabase_status = (
        ServiceStatus.ONLINE if settings.is_supabase_configured else ServiceStatus.NOT_CONFIGURED
    )
    return ApiResponse.ok(
        SystemHealthData(
            # If this response is being produced at all, the backend is up.
            backend=ServiceStatus.ONLINE,
            database=supabase_status,
            storage=supabase_status,
            # The manager's own status, not a guess. NOT_LOADED is the honest
            # answer when no manager exists - the model is, in fact, not loaded.
            ai=manager.status if manager is not None else ModelStatus.NOT_LOADED,
        ),
        message="System health retrieved successfully.",
    )
