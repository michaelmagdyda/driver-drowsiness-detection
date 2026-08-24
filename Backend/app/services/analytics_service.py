"""Analytics service - real analytics only (Phase K subset).

Three independent capabilities live here because they share a route prefix,
not because they share data: :meth:`get_ai_performance` reads a static
evaluation file; :meth:`get_session_trends` aggregates the caller's own
``detection_sessions`` rows; :meth:`get_event_trends` aggregates the
caller's own raw ``detection_events`` rows for patterns session summaries
cannot answer (hour-of-day, day-of-week, EAR/MAR-by-hour). None fabricates a
number the underlying source cannot support - see the module docstring in
:mod:`app.schemas.analytics` for what was deliberately left out.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING, Any

from app.core.constants import FATIGUE_API_SCALE, AlertLevel, DriverState
from app.core.exceptions import ServiceUnavailableError
from app.core.logging import get_logger
from app.schemas.analytics import (
    AIPerformance,
    AlertHeatmapCell,
    AlertLevelCount,
    DailyAverageFatigue,
    DailyEyeClosure,
    DailySessionCount,
    DailyYawnCount,
    EventTotals,
    EventTrends,
    HourlyAlertCounts,
    HourlyEarMar,
    SessionTotals,
    SessionTrends,
    StateCount,
    WeekdayAlertCount,
)

if TYPE_CHECKING:
    from pathlib import Path

    from app.infra.repositories.session_repository import SessionRepository
    from app.schemas.auth import AuthenticatedUser

logger = get_logger(__name__)

_ALERT_LEVEL_BUCKET_KEY: dict[AlertLevel, str] = {
    AlertLevel.LOW: "warning",
    AlertLevel.MEDIUM: "danger",
    AlertLevel.HIGH: "emergency",
}
"""Maps a non-``NONE`` alert level to its bucket key in :class:`HourlyAlertCounts`."""


class AnalyticsService:
    """Reads AI evaluation metrics and aggregates session trends.

    Args:
        metrics_path: Absolute path to the evaluation JSON file.
        repository: Reads session rows for trend aggregation. Optional because
            :meth:`get_ai_performance` needs no database access at all - a
            deployment with Supabase unconfigured can still serve it, the same
            narrower-than-``is_supabase_configured`` philosophy the JWT
            verification path already follows.
    """

    def __init__(self, *, metrics_path: Path, repository: SessionRepository | None = None) -> None:
        """Store the injected repository and the resolved metrics file path."""
        self._repository = repository
        self._metrics_path = metrics_path

    def get_ai_performance(self) -> AIPerformance:
        """Return the trained model's held-out test-set evaluation.

        Returns:
            The parsed evaluation metrics.

        Raises:
            ServiceUnavailableError: The metrics file is missing or unreadable.
        """
        try:
            raw: dict[str, Any] = json.loads(self._metrics_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            logger.error("Failed to read model evaluation metrics: %s", type(error).__name__)
            msg = "Model evaluation metrics are not available."
            raise ServiceUnavailableError(msg) from error
        return AIPerformance.from_file(raw)

    async def get_session_trends(self, user: AuthenticatedUser, *, days: int) -> SessionTrends:
        """Aggregate the caller's sessions from the last ``days`` days.

        Fetches the raw rows and buckets them in Python rather than via SQL
        aggregation - the Supabase client's fluent query builder has no
        ``GROUP BY``, and at the per-user row counts this application expects,
        a plain client-side aggregation is simpler than adding a database view
        or RPC function for it.

        Fetches the current window and the immediately preceding
        equal-length window separately (two bounded, indexed queries) so
        ``current``/``previous`` totals never require re-deriving one
        window's boundary from the other's rows.

        Args:
            user: The authenticated caller.
            days: Size of the lookback window, in days.

        Returns:
            The aggregated trends.

        Raises:
            ServiceUnavailableError: No repository was injected (Supabase is
                not configured).
            DatabaseError: Propagated from the repository.
        """
        if self._repository is None:
            msg = "Session history is not currently available."
            raise ServiceUnavailableError(msg)

        now = datetime.now(UTC)
        midpoint = now - timedelta(days=days)
        since = now - timedelta(days=2 * days)

        rows = await self._repository.list_recent_sessions(user.id, since=midpoint)
        previous_rows = await self._repository.list_recent_sessions(
            user.id, since=since, until=midpoint
        )

        sessions_by_day: dict[date, int] = {}
        fatigue_by_day: dict[date, list[int]] = {}
        eye_closure_by_day: dict[date, float] = {}
        state_counts: dict[str, int] = {}

        for row in rows:
            day = _as_date(row["started_at"])
            sessions_by_day[day] = sessions_by_day.get(day, 0) + 1
            eye_closure_by_day[day] = eye_closure_by_day.get(day, 0.0) + (
                row.get("eye_closure_seconds") or 0.0
            )

            raw_fatigue = row.get("max_fatigue_score")
            if raw_fatigue is not None:
                scaled = round(float(raw_fatigue) * FATIGUE_API_SCALE)
                fatigue_by_day.setdefault(day, []).append(scaled)

            raw_state = row.get("final_state")
            if raw_state:
                label = DriverState(raw_state).api_label
                state_counts[label] = state_counts.get(label, 0) + 1

        sessions_per_day = [
            DailySessionCount(date=day, count=count)
            for day, count in sorted(sessions_by_day.items())
        ]
        avg_fatigue_per_day = [
            DailyAverageFatigue(date=day, average_fatigue_score=sum(values) / len(values))
            for day, values in sorted(fatigue_by_day.items())
        ]
        eye_closure_per_day = [
            DailyEyeClosure(date=day, total_eye_closure_seconds=round(total, 2))
            for day, total in sorted(eye_closure_by_day.items())
        ]
        state_distribution = [
            StateCount(state=state, count=count) for state, count in sorted(state_counts.items())
        ]

        return SessionTrends(
            days=days,
            sessions_per_day=sessions_per_day,
            avg_fatigue_per_day=avg_fatigue_per_day,
            eye_closure_per_day=eye_closure_per_day,
            state_distribution=state_distribution,
            current=_session_totals(rows),
            previous=_session_totals(previous_rows),
        )

    async def get_event_trends(self, user: AuthenticatedUser, *, days: int) -> EventTrends:
        """Aggregate the caller's raw detection events from the last ``days`` days.

        A separate query from :meth:`get_session_trends`: hour-of-day,
        day-of-week and EAR/MAR-by-hour patterns need the individual events,
        not the per-session summary columns.

        Args:
            user: The authenticated caller.
            days: Size of the lookback window, in days.

        Returns:
            The aggregated event trends.

        Raises:
            ServiceUnavailableError: No repository was injected (Supabase is
                not configured).
            DatabaseError: Propagated from the repository.
        """
        if self._repository is None:
            msg = "Session history is not currently available."
            raise ServiceUnavailableError(msg)

        now = datetime.now(UTC)
        midpoint = now - timedelta(days=days)
        since = now - timedelta(days=2 * days)

        rows = await self._repository.list_recent_events(user.id, since=midpoint)
        previous_rows = await self._repository.list_recent_events(
            user.id, since=since, until=midpoint
        )

        hour_counts = {hour: {"warning": 0, "danger": 0, "emergency": 0} for hour in range(24)}
        weekday_counts: dict[int, int] = dict.fromkeys(range(7), 0)
        heatmap_counts: dict[tuple[int, int], int] = {}
        ear_by_hour: dict[int, list[float]] = {}
        mar_by_hour: dict[int, list[float]] = {}
        yawn_by_day: dict[date, int] = {}
        level_counts: dict[str, int] = {}

        for row in rows:
            ts = _as_datetime(row["ts"])
            hour, weekday = ts.hour, ts.weekday()

            level = AlertLevel(row.get("alert_level") or AlertLevel.NONE.value)
            level_counts[level.api_label] = level_counts.get(level.api_label, 0) + 1
            bucket_key = _ALERT_LEVEL_BUCKET_KEY.get(level)
            if bucket_key is not None:
                hour_counts[hour][bucket_key] += 1
                weekday_counts[weekday] += 1
                cell = (weekday, hour)
                heatmap_counts[cell] = heatmap_counts.get(cell, 0) + 1

            if row.get("ear") is not None:
                ear_by_hour.setdefault(hour, []).append(float(row["ear"]))
            if row.get("mar") is not None:
                mar_by_hour.setdefault(hour, []).append(float(row["mar"]))
            if row.get("yawning"):
                day = ts.date()
                yawn_by_day[day] = yawn_by_day.get(day, 0) + 1

        alerts_by_hour = [HourlyAlertCounts(hour=hour, **hour_counts[hour]) for hour in range(24)]
        alerts_by_weekday = [
            WeekdayAlertCount(weekday=weekday, count=weekday_counts[weekday])
            for weekday in range(7)
        ]
        alert_heatmap = [
            AlertHeatmapCell(weekday=weekday, hour=hour, count=count)
            for (weekday, hour), count in sorted(heatmap_counts.items())
        ]
        hours_with_evidence = sorted(set(ear_by_hour) | set(mar_by_hour))
        avg_ear_mar_by_hour = [
            HourlyEarMar(
                hour=hour,
                avg_ear=_mean(ear_by_hour.get(hour)),
                avg_mar=_mean(mar_by_hour.get(hour)),
            )
            for hour in hours_with_evidence
        ]
        yawn_count_by_day = [
            DailyYawnCount(date=day, count=count) for day, count in sorted(yawn_by_day.items())
        ]
        alert_level_distribution = [
            AlertLevelCount(alert_level=label, count=count)
            for label, count in sorted(level_counts.items())
        ]

        return EventTrends(
            days=days,
            alerts_by_hour=alerts_by_hour,
            alerts_by_weekday=alerts_by_weekday,
            alert_heatmap=alert_heatmap,
            avg_ear_mar_by_hour=avg_ear_mar_by_hour,
            yawn_count_by_day=yawn_count_by_day,
            alert_level_distribution=alert_level_distribution,
            current=_event_totals(rows),
            previous=_event_totals(previous_rows),
        )


def _as_date(value: str | datetime) -> date:
    """Normalise a Supabase timestamp value to a plain date.

    Args:
        value: Either an ISO-8601 string (as returned by postgrest) or an
            already-parsed :class:`datetime`.

    Returns:
        The calendar date portion.
    """
    return _as_datetime(value).date()


def _as_datetime(value: str | datetime) -> datetime:
    """Normalise a Supabase timestamp value to a :class:`datetime`.

    Args:
        value: Either an ISO-8601 string (as returned by postgrest) or an
            already-parsed :class:`datetime`.

    Returns:
        The parsed value.
    """
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value)


def _mean(values: list[float] | None) -> float | None:
    """Arithmetic mean, or ``None`` for an empty/missing sample.

    Args:
        values: Numbers to average, or ``None``.

    Returns:
        The mean rounded to 4 decimal places, or ``None``.
    """
    return round(sum(values) / len(values), 4) if values else None


def _session_totals(rows: list[dict[str, Any]]) -> SessionTotals:
    """Sum/average the per-session aggregate columns over one window's rows.

    Args:
        rows: Raw ``detection_sessions`` rows from
            :meth:`~app.infra.repositories.session_repository.SessionRepository.list_recent_sessions`.

    Returns:
        The window's real totals.
    """
    fatigue_values = [
        round(float(row["max_fatigue_score"]) * FATIGUE_API_SCALE)
        for row in rows
        if row.get("max_fatigue_score") is not None
    ]
    duration_values = [
        float(row["duration_seconds"]) for row in rows if row.get("duration_seconds") is not None
    ]
    return SessionTotals(
        total_sessions=len(rows),
        total_alerts=sum(row.get("total_alerts") or 0 for row in rows),
        total_yawns=sum(row.get("yawn_count") or 0 for row in rows),
        total_eye_closure_seconds=round(
            sum(row.get("eye_closure_seconds") or 0.0 for row in rows), 2
        ),
        avg_fatigue_score=(
            round(sum(fatigue_values) / len(fatigue_values)) if fatigue_values else None
        ),
        avg_duration_seconds=(
            round(sum(duration_values) / len(duration_values), 2) if duration_values else None
        ),
    )


def _event_totals(rows: list[dict[str, Any]]) -> EventTotals:
    """Sum/average real per-event fields over one window's rows.

    Args:
        rows: Raw ``detection_events`` rows from
            :meth:`~app.infra.repositories.session_repository.SessionRepository.list_recent_events`.

    Returns:
        The window's real totals.
    """
    confidences: list[float] = []
    for row in rows:
        detections = (row.get("metadata") or {}).get("detections") or []
        scores = [det["score"] for det in detections if "score" in det]
        if scores:
            confidences.append(max(scores))
    return EventTotals(
        total_events=len(rows),
        yawning_events=sum(1 for row in rows if row.get("yawning")),
        sleep_events=sum(1 for row in rows if row.get("state") == DriverState.SLEEPING.value),
        avg_confidence=round(sum(confidences) / len(confidences) * 100) if confidences else None,
    )
