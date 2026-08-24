"""Unit tests for the session/detection-event wire schemas.

Verifies the ``from_row`` conversions: fatigue-score scaling (0.0-1.0 ->
0-100), enum-to-frontend-spelling translation, and the ``None``-while-active
cases.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.schemas.sessions import DetectionEvent, SessionDetail, SessionSummary

pytestmark = pytest.mark.unit

SESSION_ID = UUID("7c9e6679-7425-40de-944b-e07fc1f90ae7")
USER_ID = UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
MEDIA_ID = UUID("11111111-1111-1111-1111-111111111111")
NOW = datetime(2026, 1, 15, 12, 0, tzinfo=UTC)


def make_session_row(**overrides: object) -> dict:
    row = {
        "id": str(SESSION_ID),
        "user_id": str(USER_ID),
        "source": "webcam",
        "status": "completed",
        "media_id": None,
        "started_at": NOW,
        "ended_at": NOW,
        "duration_seconds": 120.5,
        "total_events": 300,
        "total_alerts": 2,
        "yawn_count": 1,
        "eye_closure_seconds": 4.2,
        "max_fatigue_score": 0.82,
        "final_state": "drowsy",
        "created_at": NOW,
        "updated_at": NOW,
    }
    row.update(overrides)
    return row


class TestSessionSummaryFromRow:
    def test_scales_fatigue_to_0_100(self):
        summary = SessionSummary.from_row(make_session_row(max_fatigue_score=0.82))

        assert summary.max_fatigue_score == 82

    def test_missing_fatigue_is_none(self):
        summary = SessionSummary.from_row(make_session_row(max_fatigue_score=None))

        assert summary.max_fatigue_score is None

    def test_final_state_rendered_in_frontend_spelling(self):
        summary = SessionSummary.from_row(make_session_row(final_state="drowsy"))

        assert summary.final_state == "DROWSY"

    def test_alert_level_derived_from_final_state(self):
        summary = SessionSummary.from_row(make_session_row(final_state="sleeping"))

        assert summary.alert_level == "EMERGENCY"

    def test_active_session_has_no_final_state_or_alert_level(self):
        summary = SessionSummary.from_row(make_session_row(final_state=None))

        assert summary.final_state is None
        assert summary.alert_level is None

    def test_awake_maps_to_safe(self):
        summary = SessionSummary.from_row(make_session_row(final_state="awake"))

        assert summary.alert_level == "SAFE"


class TestSessionDetailFromRow:
    def test_includes_media_and_updated_at(self):
        detail = SessionDetail.from_row(make_session_row(media_id=str(MEDIA_ID)))

        assert detail.media_id == MEDIA_ID
        assert detail.updated_at == NOW

    def test_inherits_summary_fields(self):
        detail = SessionDetail.from_row(make_session_row())

        assert detail.id == SESSION_ID
        assert detail.max_fatigue_score == 82


class TestDetectionEventFromRow:
    def test_scales_fatigue_and_translates_enums(self):
        event = DetectionEvent.from_row(
            {
                "id": 42,
                "ts": NOW,
                "ear": 0.18,
                "mar": 0.4,
                "head_pitch": -3.2,
                "head_yaw": 5.1,
                "head_roll": None,
                "eye_closed": True,
                "yawning": False,
                "state": "drowsy",
                "fatigue_score": 0.55,
                "alert_level": "medium",
            }
        )

        assert event.id == 42
        assert event.state == "DROWSY"
        assert event.alert_level == "DANGER"
        assert event.fatigue_score == 55
        assert event.head_roll is None

    def test_missing_fatigue_is_none(self):
        event = DetectionEvent.from_row(
            {
                "id": 1,
                "ts": NOW,
                "state": "awake",
                "alert_level": "none",
                "fatigue_score": None,
            }
        )

        assert event.fatigue_score is None
        assert event.alert_level == "SAFE"
