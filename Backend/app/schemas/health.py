"""Health and readiness payloads.

Three endpoints with three distinct jobs, which is why they do not share a
schema:

``GET /health``
    Liveness. Is the process up and serving? Must never touch a dependency -
    an orchestrator uses this to decide whether to restart the container, and a
    momentary database blip must not trigger a restart loop.

``GET /ready``
    Readiness. Can the process serve real traffic *right now*? Checks every
    dependency and is allowed to report not-ready. Load balancers use it to
    decide whether to route traffic.

``GET /system/health``
    Operator-facing summary in the exact shape fixed by the API Specification
    §19, surfaced on the admin panel.

All three payloads nest inside the standard :class:`~app.schemas.common.ApiResponse`
envelope; none of them is returned bare.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import ModelStatus, ServiceStatus


class HealthData(BaseModel):
    """Liveness payload.

    Deliberately cheap: every value is already in memory, so the endpoint
    performs no I/O and cannot be made slow by a struggling dependency.

    Attributes:
        status: Always ``"ok"`` when the process can respond at all.
        version: Application version from ``app.__version__``.
        environment: Configured ``APP_ENV``.
        timestamp: Server time, timezone-aware UTC.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "ok",
                "version": "0.1.0",
                "environment": "development",
                "timestamp": "2026-07-24T09:30:00Z",
            }
        }
    )

    status: str = Field(default="ok", description="Liveness indicator.")
    version: str = Field(description="Application version.")
    environment: str = Field(description="Deployment environment name.")
    timestamp: datetime = Field(description="Server time in UTC.")


class DependencyStatus(BaseModel):
    """Readiness result for a single dependency.

    Attributes:
        name: Dependency identifier, e.g. ``"database"``.
        status: Current state.
        detail: Optional human-readable context. Must never contain a
            connection string, credential or stack trace (Coding Standards §13).
    """

    name: str = Field(description="Dependency identifier.")
    status: ServiceStatus = Field(description="Current dependency state.")
    detail: str | None = Field(default=None, description="Optional context, free of secrets.")


class ReadinessData(BaseModel):
    """Readiness payload.

    ``ready`` is intentionally not a simple "everything is ONLINE" test. During
    Phases D-F, Supabase and SMTP are legitimately ``NOT_CONFIGURED``, and the
    service is still perfectly able to serve the endpoints that exist. Only a
    dependency that is configured *and* failing makes the service not ready.

    Attributes:
        ready: Whether the service can serve traffic.
        dependencies: Per-dependency detail.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "ready": True,
                "dependencies": [
                    {"name": "database", "status": "not_configured", "detail": "Phase F"},
                    {"name": "ai_model", "status": "not_configured", "detail": "Phase G"},
                ],
            }
        }
    )

    ready: bool = Field(description="Whether the service can serve traffic.")
    dependencies: list[DependencyStatus] = Field(
        default_factory=list, description="Per-dependency readiness detail."
    )


class SystemHealthData(BaseModel):
    """Operator-facing system health.

    The four field names and their value vocabularies are fixed by the API
    Specification §19 and must not be renamed::

        {"backend": "online", "database": "online",
         "storage": "online", "ai": "loaded"}

    Note that ``ai`` uses :class:`~app.core.constants.ModelStatus` while the
    other three use :class:`~app.core.constants.ServiceStatus` - "loaded" is not
    a member of the latter. That asymmetry is in the specification, not an
    oversight here.

    Attributes:
        backend: Always ``ONLINE`` if this response was produced at all.
        database: Supabase PostgreSQL state.
        storage: Supabase Storage state.
        ai: AI model state.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "backend": "online",
                "database": "online",
                "storage": "online",
                "ai": "loaded",
            }
        }
    )

    backend: ServiceStatus = Field(description="Backend process state.")
    database: ServiceStatus = Field(description="Supabase PostgreSQL state.")
    storage: ServiceStatus = Field(description="Supabase Storage state.")
    ai: ModelStatus = Field(description="AI model state.")
