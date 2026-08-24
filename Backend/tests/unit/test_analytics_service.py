"""Unit tests for the analytics service.

``get_ai_performance`` is tested against a real temporary JSON file shaped
like ``ML/results/test_metrics_tuned.json``. ``get_session_trends`` is tested
against a fake repository returning raw session rows, verifying the
client-side day-bucketing and fatigue scaling.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

import pytest

from app.core.constants import AppRole
from app.core.exceptions import ServiceUnavailableError
from app.schemas.auth import AuthenticatedUser
from app.services.analytics_service import AnalyticsService

pytestmark = pytest.mark.unit

USER_ID = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
USER = AuthenticatedUser(id=USER_ID, role=AppRole.USER)

EVAL_JSON = {
    "checkpoint": "checkpoints/tuned/best.pth",
    "num_test_images": 5705,
    "iou_threshold": 0.5,
    "precision": 0.71,
    "recall": 0.83,
    "f1": 0.76,
    "mean_iou": 0.75,
    "detection_accuracy": 0.62,
    "mAP@0.5": 0.74,
    "mAP@0.5:0.95": 0.35,
    "AP_per_class": {"closed_eye": 0.73, "open_eye": 0.68, "yawn": 0.82},
}


class _FakeRepository:
    def __init__(
        self, rows: list[dict[str, Any]] | None = None, events: list[dict[str, Any]] | None = None
    ) -> None:
        self._rows = rows or []
        self._events = events or []

    async def list_recent_sessions(
        self, user_id: UUID, *, since: datetime, until: datetime | None = None  # noqa: ARG002
    ) -> list[dict[str, Any]]:
        return self._rows

    async def list_recent_events(
        self, user_id: UUID, *, since: datetime, until: datetime | None = None  # noqa: ARG002
    ) -> list[dict[str, Any]]:
        return self._events


class TestGetAIPerformance:
    def test_reads_and_converts_real_eval_file(self, tmp_path):
        metrics_path = tmp_path / "test_metrics_tuned.json"
        metrics_path.write_text(json.dumps(EVAL_JSON), encoding="utf-8")
        service = AnalyticsService(metrics_path=metrics_path)

        result = service.get_ai_performance()

        assert result.map_50 == EVAL_JSON["mAP@0.5"]
        assert result.map_50_95 == EVAL_JSON["mAP@0.5:0.95"]
        assert {c.label for c in result.ap_per_class} == {"closed_eye", "open_eye", "yawn"}

    def test_missing_file_raises_service_unavailable(self, tmp_path):
        service = AnalyticsService(metrics_path=tmp_path / "does-not-exist.json")

        with pytest.raises(ServiceUnavailableError):
            service.get_ai_performance()

    def test_malformed_file_raises_service_unavailable(self, tmp_path):
        metrics_path = tmp_path / "bad.json"
        metrics_path.write_text("not json", encoding="utf-8")
        service = AnalyticsService(metrics_path=metrics_path)

        with pytest.raises(ServiceUnavailableError):
            service.get_ai_performance()


class TestGetSessionTrends:
    async def test_buckets_sessions_by_day(self, tmp_path):
        rows = [
            {
                "started_at": "2026-01-01T08:00:00+00:00",
                "final_state": "awake",
                "max_fatigue_score": 0.1,
            },
            {
                "started_at": "2026-01-01T20:00:00+00:00",
                "final_state": "drowsy",
                "max_fatigue_score": 0.7,
            },
            {
                "started_at": "2026-01-02T08:00:00+00:00",
                "final_state": "drowsy",
                "max_fatigue_score": None,
            },
        ]
        service = AnalyticsService(
            metrics_path=tmp_path / "unused.json", repository=_FakeRepository(rows)
        )

        trends = await service.get_session_trends(USER, days=7)

        by_date = {d.date.isoformat(): d.count for d in trends.sessions_per_day}
        assert by_date == {"2026-01-01": 2, "2026-01-02": 1}

    async def test_averages_fatigue_ignoring_unscored_sessions(self, tmp_path):
        rows = [
            {
                "started_at": "2026-01-01T08:00:00+00:00",
                "final_state": None,
                "max_fatigue_score": 0.2,
            },
            {
                "started_at": "2026-01-01T09:00:00+00:00",
                "final_state": None,
                "max_fatigue_score": 0.6,
            },
            {
                "started_at": "2026-01-01T10:00:00+00:00",
                "final_state": None,
                "max_fatigue_score": None,
            },
        ]
        service = AnalyticsService(
            metrics_path=tmp_path / "unused.json", repository=_FakeRepository(rows)
        )

        trends = await service.get_session_trends(USER, days=7)

        assert len(trends.avg_fatigue_per_day) == 1
        assert trends.avg_fatigue_per_day[0].average_fatigue_score == pytest.approx(40.0)

    async def test_state_distribution_counts_final_states(self, tmp_path):
        rows = [
            {
                "started_at": "2026-01-01T08:00:00+00:00",
                "final_state": "drowsy",
                "max_fatigue_score": None,
            },
            {
                "started_at": "2026-01-02T08:00:00+00:00",
                "final_state": "drowsy",
                "max_fatigue_score": None,
            },
            {
                "started_at": "2026-01-03T08:00:00+00:00",
                "final_state": "awake",
                "max_fatigue_score": None,
            },
            {
                "started_at": "2026-01-04T08:00:00+00:00",
                "final_state": None,
                "max_fatigue_score": None,
            },
        ]
        service = AnalyticsService(
            metrics_path=tmp_path / "unused.json", repository=_FakeRepository(rows)
        )

        trends = await service.get_session_trends(USER, days=7)

        counts = {s.state: s.count for s in trends.state_distribution}
        assert counts == {"DROWSY": 2, "AWAKE": 1}

    async def test_no_repository_raises_service_unavailable(self, tmp_path):
        service = AnalyticsService(metrics_path=tmp_path / "unused.json")

        with pytest.raises(ServiceUnavailableError):
            await service.get_session_trends(USER, days=7)

    async def test_eye_closure_per_day_sums_real_zero_for_sessions_without_closure(self, tmp_path):
        rows = [
            {
                "started_at": "2026-01-01T08:00:00+00:00",
                "final_state": "awake",
                "max_fatigue_score": None,
                "eye_closure_seconds": 4.5,
            },
            {
                "started_at": "2026-01-01T20:00:00+00:00",
                "final_state": "awake",
                "max_fatigue_score": None,
                "eye_closure_seconds": None,
            },
            {
                "started_at": "2026-01-02T08:00:00+00:00",
                "final_state": "awake",
                "max_fatigue_score": None,
            },
        ]
        service = AnalyticsService(
            metrics_path=tmp_path / "unused.json", repository=_FakeRepository(rows)
        )

        trends = await service.get_session_trends(USER, days=7)

        by_date = {
            d.date.isoformat(): d.total_eye_closure_seconds for d in trends.eye_closure_per_day
        }
        assert by_date == {"2026-01-01": 4.5, "2026-01-02": 0.0}


class _FakeSplitRepository:
    """Returns different canned rows for the current vs. previous window.

    The real repository distinguishes these by an actual ``since``/``until``
    date filter; this stub distinguishes them the simpler way a fake is
    allowed to - by whether ``until`` was passed at all, since the service
    only ever passes it for the "previous period" call.
    """

    def __init__(self, current: list[dict[str, Any]], previous: list[dict[str, Any]]) -> None:
        self._current = current
        self._previous = previous

    async def list_recent_sessions(
        self, user_id: UUID, *, since: datetime, until: datetime | None = None  # noqa: ARG002
    ) -> list[dict[str, Any]]:
        return self._previous if until is not None else self._current

    async def list_recent_events(
        self, user_id: UUID, *, since: datetime, until: datetime | None = None  # noqa: ARG002
    ) -> list[dict[str, Any]]:
        return self._previous if until is not None else self._current


class TestSessionTotals:
    async def test_current_and_previous_totals_are_independent(self, tmp_path):
        current_rows = [
            {
                "started_at": "2026-01-01T08:00:00+00:00",
                "final_state": "awake",
                "max_fatigue_score": 0.4,
                "total_alerts": 2,
                "yawn_count": 3,
                "eye_closure_seconds": 5.0,
                "duration_seconds": 120.0,
            }
        ]
        previous_rows = [
            {
                "started_at": "2025-12-01T08:00:00+00:00",
                "final_state": "awake",
                "max_fatigue_score": 0.2,
                "total_alerts": 1,
                "yawn_count": 1,
                "eye_closure_seconds": 2.0,
                "duration_seconds": 60.0,
            },
            {
                "started_at": "2025-12-02T08:00:00+00:00",
                "final_state": "awake",
                "max_fatigue_score": 0.6,
                "total_alerts": 0,
                "yawn_count": 0,
                "eye_closure_seconds": 0.0,
                "duration_seconds": 180.0,
            },
        ]
        service = AnalyticsService(
            metrics_path=tmp_path / "unused.json",
            repository=_FakeSplitRepository(current_rows, previous_rows),
        )

        trends = await service.get_session_trends(USER, days=7)

        assert trends.current.total_sessions == 1
        assert trends.current.total_alerts == 2
        assert trends.current.total_yawns == 3
        assert trends.current.total_eye_closure_seconds == 5.0
        assert trends.current.avg_fatigue_score == 40
        assert trends.current.avg_duration_seconds == 120.0

        assert trends.previous.total_sessions == 2
        assert trends.previous.total_alerts == 1
        assert trends.previous.avg_fatigue_score == 40  # mean of 20 and 60
        assert trends.previous.avg_duration_seconds == 120.0

    async def test_missing_optional_columns_default_honestly(self, tmp_path):
        rows = [
            {
                "started_at": "2026-01-01T08:00:00+00:00",
                "final_state": None,
                "max_fatigue_score": None,
            }
        ]
        service = AnalyticsService(
            metrics_path=tmp_path / "unused.json",
            repository=_FakeSplitRepository(rows, []),
        )

        trends = await service.get_session_trends(USER, days=7)

        assert trends.current.total_alerts == 0
        assert trends.current.avg_fatigue_score is None
        assert trends.current.avg_duration_seconds is None
        assert trends.previous.total_sessions == 0
        assert trends.previous.avg_fatigue_score is None


class TestGetEventTrends:
    async def test_buckets_alerts_by_hour_and_weekday(self, tmp_path):
        events = [
            {
                "ts": "2026-01-05T09:15:00+00:00",
                "ear": 0.3,
                "mar": 0.5,
                "eye_closed": False,
                "yawning": False,
                "state": "yawning",
                "alert_level": "low",
                "metadata": {},
            },
            {
                "ts": "2026-01-05T09:45:00+00:00",
                "ear": None,
                "mar": None,
                "eye_closed": True,
                "yawning": False,
                "state": "sleeping",
                "alert_level": "high",
                "metadata": {},
            },
            {
                "ts": "2026-01-06T03:00:00+00:00",
                "ear": 0.5,
                "mar": 0.2,
                "eye_closed": False,
                "yawning": False,
                "state": "awake",
                "alert_level": "none",
                "metadata": {},
            },
        ]
        service = AnalyticsService(
            metrics_path=tmp_path / "unused.json",
            repository=_FakeSplitRepository(events, []),
        )

        trends = await service.get_event_trends(USER, days=7)

        hour_9 = next(h for h in trends.alerts_by_hour if h.hour == 9)
        assert hour_9.warning == 1
        assert hour_9.emergency == 1
        assert hour_9.danger == 0

        expected_weekday = datetime.fromisoformat(events[0]["ts"]).weekday()
        bucket = next(w for w in trends.alerts_by_weekday if w.weekday == expected_weekday)
        assert bucket.count == 2

        assert {c.alert_level for c in trends.alert_level_distribution} == {
            "WARNING",
            "EMERGENCY",
            "SAFE",
        }
        # Both alert events fall in the same (weekday, hour) cell.
        assert len(trends.alert_heatmap) == 1
        assert trends.alert_heatmap[0].count == 2

    async def test_avg_ear_mar_by_hour_omits_hours_without_evidence(self, tmp_path):
        events = [
            {
                "ts": "2026-01-05T09:00:00+00:00",
                "ear": 0.2,
                "mar": 0.4,
                "eye_closed": False,
                "yawning": True,
                "state": "yawning",
                "alert_level": "low",
                "metadata": {},
            },
            {
                "ts": "2026-01-05T09:30:00+00:00",
                "ear": 0.4,
                "mar": None,
                "eye_closed": False,
                "yawning": False,
                "state": "awake",
                "alert_level": "none",
                "metadata": {},
            },
        ]
        service = AnalyticsService(
            metrics_path=tmp_path / "unused.json",
            repository=_FakeSplitRepository(events, []),
        )

        trends = await service.get_event_trends(USER, days=7)

        assert len(trends.avg_ear_mar_by_hour) == 1
        hour = trends.avg_ear_mar_by_hour[0]
        assert hour.hour == 9
        assert hour.avg_ear == pytest.approx(0.3)
        assert hour.avg_mar == pytest.approx(0.4)

        assert len(trends.yawn_count_by_day) == 1
        assert trends.yawn_count_by_day[0].count == 1

    async def test_avg_confidence_from_strongest_detection_per_event(self, tmp_path):
        events = [
            {
                "ts": "2026-01-05T09:00:00+00:00",
                "ear": None,
                "mar": None,
                "eye_closed": False,
                "yawning": False,
                "state": "awake",
                "alert_level": "none",
                "metadata": {"detections": [{"score": 0.6}, {"score": 0.9}]},
            },
            {
                "ts": "2026-01-05T10:00:00+00:00",
                "ear": None,
                "mar": None,
                "eye_closed": False,
                "yawning": False,
                "state": "awake",
                "alert_level": "none",
                "metadata": {},
            },
        ]
        service = AnalyticsService(
            metrics_path=tmp_path / "unused.json",
            repository=_FakeSplitRepository(events, []),
        )

        trends = await service.get_event_trends(USER, days=7)

        assert trends.current.total_events == 2
        assert trends.current.avg_confidence == 90
        assert trends.current.sleep_events == 0

    async def test_no_repository_raises_service_unavailable(self, tmp_path):
        service = AnalyticsService(metrics_path=tmp_path / "unused.json")

        with pytest.raises(ServiceUnavailableError):
            await service.get_event_trends(USER, days=7)
