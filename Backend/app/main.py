"""Application entry point.

Builds and wires the FastAPI application. Startup order follows Deployment §10:
load configuration, initialise logging, then register middleware, error
handlers and routes.

Uses an application *factory* rather than a module-level ``FastAPI()`` so tests
can build an isolated instance with overridden settings instead of importing a
half-configured global. A module-level ``app`` is still exported for
``uvicorn app.main:app``.

Phase G attaches model loading to the ``lifespan`` hook below, which is what
guarantees the weights load exactly once per process rather than per request
(Coding Standards §25).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.api.v1 import health as health_routes
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging, get_logger
from app.dependencies.auth import AUTH_SERVICE_STATE_ATTR, JWKS_PROVIDER_STATE_ATTR
from app.dependencies.model import MODEL_MANAGER_STATE_ATTR
from app.domain.models import ModelManager, build_backend
from app.infra.jwks import JWKSProvider
from app.infra.repositories.user_repository import UserRepository
from app.infra.supabase_client import close_supabase_client, create_supabase_client
from app.middleware.error_handler import register_exception_handlers
from app.middleware.request_context import RequestContextMiddleware
from app.services.auth_service import AuthService
from app.services.role_cache import RoleCache

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

logger = get_logger(__name__)

API_TITLE = "Driver Drowsiness Detection API"
API_DESCRIPTION = """
REST API for the AI-Based Driver Drowsiness Detection System.

Every endpoint returns the standard envelope defined in the API Specification
section 3:

* **Success** - `{"success": true, "message": "...", "data": {...}}`
* **Error** - `{"success": false, "message": "...", "error_code": "...", "errors": []}`

Responses carry an `X-Request-ID` header. Quote it when reporting a problem: it
is the key that ties a failure to its server-side log entry.
"""

# Only the tags in use are declared. The remaining groups from openapi.json
# (Authentication, Sessions, ...) are added by the phase that introduces their
# endpoints, so the documentation never advertises routes that do not exist.
OPENAPI_TAGS = [
    {
        "name": "Health",
        "description": "Liveness, readiness and system status checks.",
    },
    {
        "name": "AI Analysis",
        "description": "Drowsiness detection on uploaded images and videos.",
    },
]


def _build_model_manager(settings: Settings) -> ModelManager:
    """Construct (but do not load) the model manager from settings.

    Kept separate from :func:`create_app` so a test can build a manager around a
    fake backend and place it on ``app.state`` without touching the real
    checkpoint.

    Args:
        settings: Validated application settings.

    Returns:
        An un-loaded :class:`ModelManager` wrapping the Faster R-CNN backend.
    """
    backend = build_backend(settings, settings.model_path)
    return ModelManager(backend, backend_factory=lambda path: build_backend(settings, path))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage startup and shutdown.

    Everything expensive and process-wide is created here, once, and released on
    the way out. Process-wide resources are stored on ``app.state`` so request
    handlers reach them by dependency injection rather than a module global.

    Settings are read from ``app.state`` - populated by :func:`create_app` - not
    from the global cache, so an application built with injected settings (as in
    tests) initialises against exactly those.

    Args:
        app: The application being started.

    Yields:
        Control to the running application.
    """
    settings: Settings = app.state.settings
    logger.info("Starting %s v%s (environment=%s)", API_TITLE, __version__, settings.app_env)

    if not settings.allowed_origins:
        # Not fatal in development, but the frontend cannot call the API without
        # it, and that failure is opaque from the browser side.
        logger.warning(
            "ALLOWED_ORIGINS is empty - browser requests will be blocked by CORS. "
            "Set it in .env before connecting the frontend."
        )

    # Supabase service-role client: created once here, shared through DI.
    app.state.supabase_client = None
    if settings.is_supabase_configured:
        app.state.supabase_client = await create_supabase_client(settings)
    else:
        logger.warning(
            "Supabase is not configured - database features are unavailable. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env."
        )

    # Phase E5: JWT verification needs only the project URL (public keys), not
    # the service-role key, so it is wired independently of the client above -
    # a deployment missing only the database credential can still authenticate
    # users (see Settings.is_jwt_verification_configured).
    app.state.httpx_client = None
    setattr(app.state, JWKS_PROVIDER_STATE_ATTR, None)
    if settings.is_jwt_verification_configured and settings.supabase_jwks_url is not None:
        app.state.httpx_client = httpx.AsyncClient()
        setattr(
            app.state,
            JWKS_PROVIDER_STATE_ATTR,
            JWKSProvider(
                settings.supabase_jwks_url,
                http_client=app.state.httpx_client,
                cache_ttl_seconds=settings.jwt_jwks_cache_ttl,
                min_refresh_interval_seconds=settings.jwt_jwks_min_refresh_interval,
            ),
        )
    else:
        logger.warning(
            "JWT verification is not configured - SUPABASE_URL is unset. "
            "Authenticated endpoints will return 503."
        )

    # Role resolution needs the database client, so it depends on Supabase
    # having loaded successfully above.
    setattr(app.state, AUTH_SERVICE_STATE_ATTR, None)
    if app.state.supabase_client is not None:
        user_repository = UserRepository(app.state.supabase_client)
        role_cache = RoleCache(ttl_seconds=settings.auth_role_cache_ttl)
        setattr(app.state, AUTH_SERVICE_STATE_ATTR, AuthService(user_repository, role_cache))

    # Phase G: load the AI model once, here. A failed load is recorded on the
    # manager (status FAILED) and does NOT abort startup - the service comes up
    # degraded and inference returns a clean 503 until the checkpoint is fixed
    # and the process is restarted (Deployment §23).
    manager = _build_model_manager(settings)
    manager.load(warmup=settings.is_production)
    setattr(app.state, MODEL_MANAGER_STATE_ATTR, manager)

    logger.info("Application startup complete")
    yield

    if app.state.supabase_client is not None:
        await close_supabase_client(app.state.supabase_client)
    if app.state.httpx_client is not None:
        await app.state.httpx_client.aclose()
    logger.info("Application shutdown complete")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build a configured application instance.

    Args:
        settings: Optional pre-built settings, used by tests to inject an
            isolated configuration. Defaults to the cached process settings.

    Returns:
        A fully wired :class:`FastAPI` application.

    Raises:
        ConfigurationError: If required environment variables are missing or
            invalid. Raised here so misconfiguration fails at startup rather
            than on the first request.
    """
    settings = settings or get_settings()
    configure_logging(settings)

    application = FastAPI(
        title=API_TITLE,
        description=API_DESCRIPTION,
        version=__version__,
        openapi_tags=OPENAPI_TAGS,
        lifespan=lifespan,
        # Swagger stays enabled in every environment: Deployment §15 publishes
        # it at /docs and §24 lists "Swagger Available" on the production
        # checklist.
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Make the settings this app was built with available to the lifespan hook,
    # which must not read the global cache (tests inject their own settings).
    application.state.settings = settings
    application.state.supabase_client = None
    application.state.httpx_client = None
    setattr(application.state, JWKS_PROVIDER_STATE_ATTR, None)
    setattr(application.state, AUTH_SERVICE_STATE_ATTR, None)
    setattr(application.state, MODEL_MANAGER_STATE_ATTR, None)

    _configure_middleware(application, settings)
    register_exception_handlers(application)
    _configure_routes(application, settings)

    return application


def _configure_middleware(application: FastAPI, settings: Settings) -> None:
    """Register middleware.

    Order matters and is counter-intuitive: Starlette applies middleware in
    reverse registration order, so the component added *last* sits outermost.
    ``RequestContextMiddleware`` is registered last so it wraps CORS, and the
    access log therefore records the true final status - including responses
    that CORS rejects.

    Args:
        application: The application being configured.
        settings: Validated application settings.
    """
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # Lets the browser read the correlation id, so a frontend error report
        # can include the id that identifies the matching server-side log.
        expose_headers=["X-Request-ID"],
    )
    application.add_middleware(RequestContextMiddleware)


def _configure_routes(application: FastAPI, settings: Settings) -> None:
    """Mount the API routers.

    The health router is mounted twice, deliberately:

    1. Under the versioned prefix, where it is documented and consistent with
       every other endpoint.
    2. At the root, hidden from the schema, because container orchestrators and
       load balancers conventionally probe ``/health`` and ``/ready``. Hard-coding
       a versioned path into infrastructure config would break the probes the
       moment the API version changed - precisely when the service most needs
       to be observable.

    ``include_in_schema=False`` on the root copy keeps the OpenAPI document
    free of duplicate operations.

    Args:
        application: The application being configured.
        settings: Validated application settings supplying the version prefix.
    """
    application.include_router(api_router, prefix=settings.api_v1_prefix)
    application.include_router(health_routes.router, include_in_schema=False)


app = create_app()
"""Module-level application for ``uvicorn app.main:app``."""
