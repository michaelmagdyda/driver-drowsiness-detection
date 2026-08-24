"""Analytics schemas - real, non-fabricated analytics only.

Three genuinely different data sources, all real:

* :class:`AIPerformance` comes from the trained model's held-out test-set
  evaluation (``ML/results/test_metrics_tuned.json``) - measured once during
  training, not recomputable per request.
* :class:`SessionTrends` is aggregated from the caller's own
  ``detection_sessions`` rows (session-level: counts, durations, per-session
  aggregates already written at session-completion time).
* :class:`EventTrends` is aggregated from the caller's own raw
  ``detection_events`` rows (event-level: hour-of-day and day-of-week
  patterns, EAR/MAR-by-hour - anything ``detection_sessions``' own summary
  columns cannot answer).

Deliberately excluded: live infrastructure telemetry (GPU/CPU/memory,
uptime, service health - ``GET /system/health`` already covers the real
subset of this) and synthesized composite scores ("behaviour radar",
free-text "insights") that the frontend's mock data invents but no table or
metrics file backs.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class ClassAveragePrecision(BaseModel):
    """Average precision for one foreground class.

    Attributes:
        label: Class name, e.g. ``"closed_eye"``.
        average_precision: AP at the evaluation's IoU threshold, ``0..1``.
    """

    label: str
    average_precision: float = Field(ge=0.0, le=1.0)


class AIPerformance(BaseModel):
    """The trained model's held-out test-set evaluation.

    Attributes:
        checkpoint: Which checkpoint was evaluated.
        num_test_images: Size of the held-out test set.
        iou_threshold: IoU threshold used to count a detection as correct.
        precision: Overall precision.
        recall: Overall recall.
        f1: Overall F1 score.
        mean_iou: Mean IoU across matched detections.
        detection_accuracy: TP / (TP + FP + FN), the project's custom metric.
        map_50: Mean Average Precision at IoU 0.5.
        map_50_95: Mean Average Precision averaged over IoU 0.5-0.95.
        ap_per_class: Average precision broken down by class.
    """

    model_config = {
        "json_schema_extra": {
            "example": {
                "checkpoint": "checkpoints/tuned/best.pth",
                "num_test_images": 5705,
                "iou_threshold": 0.5,
                "precision": 0.71,
                "recall": 0.83,
                "f1": 0.76,
                "mean_iou": 0.75,
                "detection_accuracy": 0.62,
                "map_50": 0.74,
                "map_50_95": 0.35,
                "ap_per_class": [{"label": "closed_eye", "average_precision": 0.73}],
            }
        }
    }

    checkpoint: str
    num_test_images: int = Field(ge=0)
    iou_threshold: float = Field(ge=0.0, le=1.0)
    precision: float = Field(ge=0.0, le=1.0)
    recall: float = Field(ge=0.0, le=1.0)
    f1: float = Field(ge=0.0, le=1.0)
    mean_iou: float = Field(ge=0.0, le=1.0)
    detection_accuracy: float = Field(ge=0.0, le=1.0)
    map_50: float = Field(ge=0.0, le=1.0)
    map_50_95: float = Field(ge=0.0, le=1.0)
    ap_per_class: list[ClassAveragePrecision]

    @classmethod
    def from_file(cls, data: dict[str, Any]) -> AIPerformance:
        """Build the schema from the raw evaluation JSON.

        Args:
            data: Parsed contents of ``test_metrics_tuned.json``.

        Returns:
            A populated :class:`AIPerformance`.
        """
        return cls(
            checkpoint=data["checkpoint"],
            num_test_images=data["num_test_images"],
            iou_threshold=data["iou_threshold"],
            precision=data["precision"],
            recall=data["recall"],
            f1=data["f1"],
            mean_iou=data["mean_iou"],
            detection_accuracy=data["detection_accuracy"],
            map_50=data["mAP@0.5"],
            map_50_95=data["mAP@0.5:0.95"],
            ap_per_class=[
                ClassAveragePrecision(label=label, average_precision=value)
                for label, value in data["AP_per_class"].items()
            ],
        )


class DailySessionCount(BaseModel):
    """Number of sessions started on one day.

    Attributes:
        date: The day, in the caller's stored timezone (UTC).
        count: Sessions started that day.
    """

    date: date
    count: int = Field(ge=0)


class DailyEyeClosure(BaseModel):
    """Cumulative eyes-closed time across sessions started on one day.

    Attributes:
        date: The day.
        total_eye_closure_seconds: Sum of each session's cumulative
            eye-closure time, seconds. Emitted for every day that had at
            least one session, including a real ``0.0`` when none of that
            day's sessions recorded any closed-eye time.
    """

    date: date
    total_eye_closure_seconds: float = Field(ge=0.0)


class DailyAverageFatigue(BaseModel):
    """Average peak fatigue score across sessions started on one day.

    Attributes:
        date: The day.
        average_fatigue_score: Mean of each session's ``max_fatigue_score``,
            0-100 scale. Only sessions that have recorded a score contribute.
    """

    date: date
    average_fatigue_score: float = Field(ge=0.0, le=100.0)


class StateCount(BaseModel):
    """Number of sessions that ended in a given classified state.

    Attributes:
        state: Frontend spelling, e.g. ``"DROWSY"``.
        count: Sessions ending in that state.
    """

    state: str
    count: int = Field(ge=0)


class SessionTotals(BaseModel):
    """Real aggregate totals over a lookback window, for the KPI cards.

    ``total_alerts``/``total_yawns``/``total_eye_closure_seconds`` are plain
    sums of the per-session columns the write path already populates
    (``detection_sessions.total_alerts``/``yawn_count``/``eye_closure_seconds``).
    ``avg_fatigue_score``/``avg_duration_seconds`` are means over sessions
    that recorded a value - ``None`` when none did, never a fabricated zero.

    Attributes:
        total_sessions: Number of sessions in the window.
        total_alerts: Sum of each session's alert-episode count.
        total_yawns: Sum of each session's yawn count.
        total_eye_closure_seconds: Sum of each session's cumulative eye-closure time.
        avg_fatigue_score: Mean of each session's peak fatigue, 0-100 scale.
        avg_duration_seconds: Mean session duration, seconds.
    """

    total_sessions: int = Field(ge=0)
    total_alerts: int = Field(ge=0)
    total_yawns: int = Field(ge=0)
    total_eye_closure_seconds: float = Field(ge=0.0)
    avg_fatigue_score: int | None = Field(default=None, ge=0, le=100)
    avg_duration_seconds: float | None = None


class SessionTrends(BaseModel):
    """Real, aggregated trends over the caller's recent sessions.

    Attributes:
        days: Size of the lookback window this aggregation covers.
        sessions_per_day: Daily session counts, days with zero sessions omitted.
        avg_fatigue_per_day: Daily average peak fatigue, days with no scored
            sessions omitted.
        eye_closure_per_day: Daily cumulative eye-closure time, over the same
            days as ``sessions_per_day``.
        state_distribution: Count of sessions per final classified state.
        current: Aggregate totals over the current ``days``-sized window.
        previous: Aggregate totals over the immediately preceding
            equal-length window, for "vs last period" comparisons - zeroed
            fields when that window has no sessions, never a fabricated
            trend.
    """

    days: int = Field(gt=0)
    sessions_per_day: list[DailySessionCount]
    avg_fatigue_per_day: list[DailyAverageFatigue]
    eye_closure_per_day: list[DailyEyeClosure]
    state_distribution: list[StateCount]
    current: SessionTotals
    previous: SessionTotals


class HourlyAlertCounts(BaseModel):
    """Alert-severity counts for one hour of the day (0-23), across all days in range.

    ``SAFE`` frames are not alerts and are not counted here - see
    :class:`AlertLevelCount` for the full severity breakdown.

    Attributes:
        hour: Hour of day, 0-23.
        warning: Count of events at ``WARNING`` severity.
        danger: Count of events at ``DANGER`` severity.
        emergency: Count of events at ``EMERGENCY`` severity.
    """

    hour: int = Field(ge=0, le=23)
    warning: int = Field(ge=0)
    danger: int = Field(ge=0)
    emergency: int = Field(ge=0)


class WeekdayAlertCount(BaseModel):
    """Alert count for one day of the week, across all weeks in range.

    Attributes:
        weekday: Day of week, 0 (Monday) - 6 (Sunday), matching :meth:`datetime.date.weekday`.
        count: Events at ``WARNING`` severity or worse on that weekday.
    """

    weekday: int = Field(ge=0, le=6)
    count: int = Field(ge=0)


class AlertHeatmapCell(BaseModel):
    """Alert count for one (weekday, hour) cell.

    Attributes:
        weekday: Day of week, 0 (Monday) - 6 (Sunday).
        hour: Hour of day, 0-23.
        count: Events at ``WARNING`` severity or worse in that cell.
    """

    weekday: int = Field(ge=0, le=6)
    hour: int = Field(ge=0, le=23)
    count: int = Field(ge=0)


class HourlyEarMar(BaseModel):
    """Mean EAR/MAR proxy for one hour of the day, over events with evidence.

    Attributes:
        hour: Hour of day, 0-23.
        avg_ear: Mean eye-aspect-ratio proxy, ``None`` if no event that hour
            had eye evidence.
        avg_mar: Mean mouth-aspect-ratio proxy, ``None`` if no event that
            hour had yawn evidence.
    """

    hour: int = Field(ge=0, le=23)
    avg_ear: float | None = None
    avg_mar: float | None = None


class DailyYawnCount(BaseModel):
    """Number of events classified as yawning on one day.

    Attributes:
        date: The day.
        count: Yawning events that day.
    """

    date: date
    count: int = Field(ge=0)


class AlertLevelCount(BaseModel):
    """Number of events at one alert severity.

    Attributes:
        alert_level: Frontend spelling, e.g. ``"WARNING"``.
        count: Events at that severity.
    """

    alert_level: str
    count: int = Field(ge=0)


class EventTotals(BaseModel):
    """Real aggregate totals over a lookback window, computed from raw events.

    Attributes:
        total_events: Number of events in the window.
        yawning_events: Events classified as yawning.
        sleep_events: Events classified in the ``SLEEPING`` state.
        avg_confidence: Mean of each event's strongest detection score,
            0-100 scale - the same per-event computation
            ``DetectionEvent.from_row`` already does, aggregated here.
            ``None`` when no event in the window had a detection.
    """

    total_events: int = Field(ge=0)
    yawning_events: int = Field(ge=0)
    sleep_events: int = Field(ge=0)
    avg_confidence: int | None = Field(default=None, ge=0, le=100)


class EventTrends(BaseModel):
    """Real, aggregated trends over the caller's recent detection events.

    A separate capability from :class:`SessionTrends`: this aggregates raw
    ``detection_events`` rows rather than session summaries, which is what
    makes hour-of-day/day-of-week patterns and EAR/MAR-by-hour possible.

    Attributes:
        days: Size of the lookback window this aggregation covers.
        alerts_by_hour: Full 24-hour breakdown, zero-filled for hours with
            no alerts.
        alerts_by_weekday: Full 7-day breakdown, zero-filled.
        alert_heatmap: Sparse (weekday, hour) cells with at least one alert.
        avg_ear_mar_by_hour: Sparse, hours with no eye/yawn evidence omitted.
        yawn_count_by_day: Sparse, days with zero yawning events omitted.
        alert_level_distribution: Count of events per alert severity.
        current: Aggregate totals over the current ``days``-sized window.
        previous: Aggregate totals over the immediately preceding
            equal-length window, for "vs last period" comparisons.
    """

    days: int = Field(gt=0)
    alerts_by_hour: list[HourlyAlertCounts]
    alerts_by_weekday: list[WeekdayAlertCount]
    alert_heatmap: list[AlertHeatmapCell]
    avg_ear_mar_by_hour: list[HourlyEarMar]
    yawn_count_by_day: list[DailyYawnCount]
    alert_level_distribution: list[AlertLevelCount]
    current: EventTotals
    previous: EventTotals
