"""API tests for the analytics endpoints.

``/ai-performance`` needs no database, only settings + auth, so its tests
override just ``get_current_user`` and point ``model_metrics_path`` at a
temporary file. ``/trends`` additionally overrides ``get_supabase_client``
with a fake session table.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_supabase_client
from app.schemas.auth import AuthenticatedUser

pytestmark = pytest.mark.api

USER_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"

JWT_SETTINGS = {
    "supabase_url": "https://testref.supabase.co",
    "supabase_service_role_key": "test-service-role-key",
}

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


def override_current_user(app: Any) -> None:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=UUID(USER_ID))


class _FakeQuery:
    def __init__(self, rows: Any) -> None:
        self._rows = rows

    def select(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def eq(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def gte(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def lt(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    async def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._rows, count=None)


class _FakeSupabaseClient:
    def __init__(self, rows: Any) -> None:
        self._rows = rows

    def table(self, _name: str) -> _FakeQuery:
        return _FakeQuery(self._rows)


class TestAIPerformanceEndpoint:
    def test_requires_auth(self, make_client, tmp_path):
        metrics_path = tmp_path / "metrics.json"
        metrics_path.write_text(json.dumps(EVAL_JSON), encoding="utf-8")

        with make_client(model_metrics_path=metrics_path, **JWT_SETTINGS) as client:
            response = client.get("/api/v1/analytics/ai-performance")

        assert response.status_code == 401

    def test_returns_real_eval_metrics(self, make_client, tmp_path):
        metrics_path = tmp_path / "metrics.json"
        metrics_path.write_text(json.dumps(EVAL_JSON), encoding="utf-8")
        built = make_client(model_metrics_path=metrics_path)
        override_current_user(built.app)

        with built as client:
            response = client.get("/api/v1/analytics/ai-performance")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["map_50"] == EVAL_JSON["mAP@0.5"]
        assert len(data["ap_per_class"]) == 3

    def test_missing_metrics_file_returns_503(self, make_client, tmp_path):
        built = make_client(model_metrics_path=tmp_path / "missing.json")
        override_current_user(built.app)

        with built as client:
            response = client.get("/api/v1/analytics/ai-performance")

        assert response.status_code == 503


class TestSessionTrendsEndpoint:
    def test_requires_auth(self, make_client):
        with make_client(**JWT_SETTINGS) as client:
            response = client.get("/api/v1/analytics/trends")

        assert response.status_code == 401

    def test_returns_aggregated_trends(self, make_client):
        built = make_client()
        override_current_user(built.app)
        rows = [
            {
                "started_at": "2026-01-01T08:00:00+00:00",
                "final_state": "drowsy",
                "max_fatigue_score": 0.5,
            }
        ]
        built.app.dependency_overrides[get_supabase_client] = lambda: _FakeSupabaseClient(rows)

        with built as client:
            response = client.get("/api/v1/analytics/trends?days=7")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["days"] == 7
        assert data["sessions_per_day"] == [{"date": "2026-01-01", "count": 1}]
        assert data["state_distribution"] == [{"state": "DROWSY", "count": 1}]
        assert data["current"]["total_sessions"] == 1
        assert data["current"]["avg_fatigue_score"] == 50
        assert "previous" in data


class TestEventTrendsEndpoint:
    def test_requires_auth(self, make_client):
        with make_client(**JWT_SETTINGS) as client:
            response = client.get("/api/v1/analytics/event-trends")

        assert response.status_code == 401

    def test_returns_aggregated_event_trends(self, make_client):
        built = make_client()
        override_current_user(built.app)
        rows = [
            {
                "ts": "2026-01-05T09:15:00+00:00",
                "ear": 0.3,
                "mar": 0.5,
                "eye_closed": False,
                "yawning": True,
                "state": "yawning",
                "alert_level": "low",
                "metadata": {"detections": [{"score": 0.8}]},
            }
        ]
        built.app.dependency_overrides[get_supabase_client] = lambda: _FakeSupabaseClient(rows)

        with built as client:
            response = client.get("/api/v1/analytics/event-trends?days=7")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["days"] == 7
        assert len(data["alerts_by_hour"]) == 24
        assert len(data["alerts_by_weekday"]) == 7
        assert data["current"]["total_events"] == 1
        assert data["current"]["yawning_events"] == 1
        assert data["current"]["avg_confidence"] == 80
