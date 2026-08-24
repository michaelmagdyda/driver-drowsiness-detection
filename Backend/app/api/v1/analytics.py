"""Analytics endpoints (Phase K subset) - real analytics only.

Two endpoints, two independent data sources: ``/ai-performance`` reads the
model's held-out test-set evaluation file; ``/trends`` aggregates the
caller's own session history. See :mod:`app.schemas.analytics` for what was
deliberately left out (live infra telemetry, fabricated composite scores).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.config import Settings, get_settings
from app.dependencies.auth import CurrentUserDep
from app.dependencies.database import SupabaseClientDep
from app.infra.repositories.session_repository import SessionRepository
from app.schemas.analytics import AIPerformance, EventTrends, SessionTrends
from app.schemas.common import ApiResponse
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

SettingsDep = Annotated[Settings, Depends(get_settings)]
DaysParam = Annotated[int, Query(ge=1, le=90, description="Lookback window, in days.")]


@router.get(
    "/ai-performance",
    summary="AI Model Performance",
    description=(
        "Return the trained model's held-out test-set evaluation: precision, "
        "recall, F1, mean IoU, mAP@0.5, mAP@0.5:0.95 and per-class AP. These "
        "are measured once during training, not recomputed per request."
    ),
    response_model=ApiResponse[AIPerformance],
)
async def get_ai_performance(
    _user: CurrentUserDep,
    settings: SettingsDep,
) -> ApiResponse[AIPerformance]:
    """Return the model's offline evaluation metrics.

    Args:
        _user: Injected authenticated caller. Unused beyond gating access -
            this endpoint reads a static file, not per-user data.
        settings: Injected application settings, for the metrics file path.

    Returns:
        The standard envelope wrapping :class:`AIPerformance`.
    """
    service = AnalyticsService(metrics_path=settings.model_metrics_path)
    result = service.get_ai_performance()
    return ApiResponse.ok(result, message="AI performance metrics retrieved.")


@router.get(
    "/trends",
    summary="Session Trends",
    description=(
        "Aggregate the caller's own sessions over a lookback window: daily "
        "counts, daily average fatigue, and final-state distribution."
    ),
    response_model=ApiResponse[SessionTrends],
)
async def get_session_trends(
    user: CurrentUserDep,
    client: SupabaseClientDep,
    settings: SettingsDep,
    days: DaysParam = 14,
) -> ApiResponse[SessionTrends]:
    """Return real, aggregated session trends for the caller.

    Args:
        user: Injected authenticated caller.
        client: Injected Supabase client.
        settings: Injected application settings, for the metrics file path.
        days: Size of the lookback window, in days.

    Returns:
        The standard envelope wrapping :class:`SessionTrends`.
    """
    service = AnalyticsService(
        metrics_path=settings.model_metrics_path,
        repository=SessionRepository(client),
    )
    result = await service.get_session_trends(user, days=days)
    return ApiResponse.ok(result, message="Session trends retrieved.")


@router.get(
    "/event-trends",
    summary="Event Trends",
    description=(
        "Aggregate the caller's own raw detection events over a lookback "
        "window: alerts by hour/weekday/heatmap, average EAR/MAR by hour, "
        "yawning events by day, and alert-severity distribution."
    ),
    response_model=ApiResponse[EventTrends],
)
async def get_event_trends(
    user: CurrentUserDep,
    client: SupabaseClientDep,
    settings: SettingsDep,
    days: DaysParam = 14,
) -> ApiResponse[EventTrends]:
    """Return real, aggregated event trends for the caller.

    Args:
        user: Injected authenticated caller.
        client: Injected Supabase client.
        settings: Injected application settings, for the metrics file path.
        days: Size of the lookback window, in days.

    Returns:
        The standard envelope wrapping :class:`EventTrends`.
    """
    service = AnalyticsService(
        metrics_path=settings.model_metrics_path,
        repository=SessionRepository(client),
    )
    result = await service.get_event_trends(user, days=days)
    return ApiResponse.ok(result, message="Event trends retrieved.")
