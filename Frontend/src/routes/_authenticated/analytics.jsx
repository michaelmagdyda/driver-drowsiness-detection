import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  getAIPerformance,
  getSessionTrends,
  getEventTrends,
  getSystemHealth,
  listSessions,
  ApiError,
} from "@/lib/api";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  ChevronRight,
  Download,
  RefreshCw,
  Calendar,
  Cpu,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { KPIStatCard } from "@/components/analytics/KPIStatCard";
import { AIPerformanceCard } from "@/components/analytics/AIPerformanceCard";
import { AnalyticsChartCard, AXIS, GRID, TT } from "@/components/analytics/AnalyticsChartCard";
import { FilterPanel } from "@/components/analytics/FilterPanel";
import { HealthCard } from "@/components/analytics/HealthCard";
import { ExportPanel } from "@/components/analytics/ExportPanel";
import { AlertHeatmap } from "@/components/analytics/AlertHeatmap";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — DriveAlert Cockpit" },
      {
        name: "description",
        content: "Your monitoring sessions, driver behavior, and AI model performance.",
      },
      { property: "og:title", content: "Analytics — DriveAlert Cockpit" },
      {
        property: "og:description",
        content: "Your monitoring sessions, driver behavior, and AI model performance.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const RANGE_DAYS = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SEVERITY_BAR_KEY = { WARNING: "warning", DANGER: "danger", EMERGENCY: "emergency" };
const STATE_COLORS = {
  AWAKE: "var(--color-signal-awake)",
  YAWNING: "var(--color-signal-drowsy)",
  DROWSY: "oklch(0.75 0.18 55)",
  SLEEPING: "var(--color-signal-danger)",
  UNKNOWN: "var(--color-muted-foreground)",
};
const ALERT_COLORS = {
  SAFE: "var(--color-signal-awake)",
  WARNING: "var(--color-signal-drowsy)",
  DANGER: "oklch(0.75 0.18 55)",
  EMERGENCY: "var(--color-signal-danger)",
};
const DURATION_BUCKETS = [
  { range: "0-5m", max: 5 * 60 },
  { range: "5-15m", max: 15 * 60 },
  { range: "15-30m", max: 30 * 60 },
  { range: "30-60m", max: 60 * 60 },
  { range: "1-2h", max: 2 * 60 * 60 },
  { range: "2h+", max: Infinity },
];

/** Percent change vs. a prior value, or `null` when there's no real baseline to compare against. */
function deltaPercent(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Buckets sparse daily averages into consecutive 7-day windows, for a "weekly" view built from real daily data. */
function bucketWeekly(avgFatiguePerDay) {
  if (!avgFatiguePerDay || avgFatiguePerDay.length === 0) return [];
  const sorted = [...avgFatiguePerDay].sort((a, b) => a.date.localeCompare(b.date));
  const start = new Date(sorted[0].date);
  const weeks = new Map();
  for (const { date, averageFatigueScore } of sorted) {
    const dayOffset = Math.floor((new Date(date) - start) / 86_400_000);
    const week = Math.floor(dayOffset / 7);
    const bucket = weeks.get(week) ?? [];
    bucket.push(averageFatigueScore);
    weeks.set(week, bucket);
  }
  return [...weeks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, values]) => ({
      week: `W${week + 1}`,
      fatigue: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length),
    }));
}

/** Buckets real session durations (most recent sessions) into display ranges. */
function bucketDurations(sessions) {
  const counts = DURATION_BUCKETS.map((b) => ({ range: b.range, count: 0 }));
  for (const s of sessions) {
    if (s.durationSeconds == null) continue;
    const idx = DURATION_BUCKETS.findIndex((b) => s.durationSeconds <= b.max);
    counts[idx === -1 ? counts.length - 1 : idx].count += 1;
  }
  return counts;
}

function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [severity, setSeverity] = useState("all");
  const [refreshTick, setRefreshTick] = useState(0);

  const [aiPerf, setAiPerf] = useState(null);
  const [aiPerfError, setAiPerfError] = useState(null);

  const [sessionTrends, setSessionTrends] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("loading");
  const [sessionError, setSessionError] = useState(null);

  const [eventTrends, setEventTrends] = useState(null);
  const [eventStatus, setEventStatus] = useState("loading");
  const [eventError, setEventError] = useState(null);

  const [weeklyTrends, setWeeklyTrends] = useState(null);
  const [weeklyStatus, setWeeklyStatus] = useState("loading");

  const [recentSessions, setRecentSessions] = useState([]);
  const [recentSessionsStatus, setRecentSessionsStatus] = useState("loading");

  const [systemHealth, setSystemHealth] = useState(null);
  const [systemHealthError, setSystemHealthError] = useState(null);

  useEffect(() => {
    getAIPerformance()
      .then(setAiPerf)
      .catch((err) => setAiPerfError(err instanceof ApiError ? err.message : "Unavailable."));
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;
    setSessionStatus("loading");
    getSessionTrends({ days: RANGE_DAYS[range] ?? 30 })
      .then((data) => {
        if (cancelled) return;
        setSessionTrends(data);
        setSessionStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionError(err instanceof ApiError ? err.message : "Failed to load trends.");
        setSessionStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [range, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    setEventStatus("loading");
    getEventTrends({ days: RANGE_DAYS[range] ?? 30 })
      .then((data) => {
        if (cancelled) return;
        setEventTrends(data);
        setEventStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setEventError(err instanceof ApiError ? err.message : "Failed to load event trends.");
        setEventStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [range, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    setWeeklyStatus("loading");
    // Independent of `range` - a 12-week view needs its own, longer lookback.
    getSessionTrends({ days: 84 })
      .then((data) => {
        if (cancelled) return;
        setWeeklyTrends(data);
        setWeeklyStatus("done");
      })
      .catch(() => {
        if (cancelled) return;
        setWeeklyStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;
    setRecentSessionsStatus("loading");
    listSessions({ page: 1, pageSize: 100 })
      .then((result) => {
        if (cancelled) return;
        setRecentSessions(result.items);
        setRecentSessionsStatus("done");
      })
      .catch(() => {
        if (cancelled) return;
        setRecentSessionsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    getSystemHealth()
      .then(setSystemHealth)
      .catch((err) => setSystemHealthError(err instanceof ApiError ? err.message : "Unavailable."));
  }, [refreshTick]);

  // Merge the two real daily session series into one array for the chart, keyed by date.
  const dailyTrend = (() => {
    if (!sessionTrends) return [];
    const byDate = new Map();
    for (const { date, count } of sessionTrends.sessionsPerDay) {
      byDate.set(date, { day: date, sessions: count, fatigue: 0 });
    }
    for (const { date, averageFatigueScore } of sessionTrends.avgFatiguePerDay) {
      const entry = byDate.get(date) ?? { day: date, sessions: 0, fatigue: 0 };
      entry.fatigue = Math.round(averageFatigueScore);
      byDate.set(date, entry);
    }
    return [...byDate.values()].sort((a, b) => a.day.localeCompare(b.day));
  })();

  const weeklyFatigue = bucketWeekly(weeklyTrends?.avgFatiguePerDay);
  const earMarData =
    eventTrends?.avgEarMarByHour.map((h) => ({ h: `${h.hour}h`, ear: h.avgEar, mar: h.avgMar })) ??
    [];
  const yawnFreqData =
    eventTrends?.yawnCountByDay.map((d) => ({ day: d.date, yawns: d.count })) ?? [];
  const eyeClosureData =
    sessionTrends?.eyeClosurePerDay.map((d) => ({
      day: d.date,
      seconds: d.totalEyeClosureSeconds,
    })) ?? [];
  const sessionDurationBuckets = bucketDurations(recentSessions);
  const alertHourData =
    eventTrends?.alertsByHour.map((d) => ({
      h: `${d.hour}h`,
      warning: d.warning,
      danger: d.danger,
      emergency: d.emergency,
    })) ?? [];
  const alertsByDayData =
    eventTrends?.alertsByWeekday.map((d) => ({ d: WEEKDAY_LABELS[d.weekday], alerts: d.count })) ??
    [];

  const kpisReady = sessionStatus === "done" && eventStatus === "done";
  const kpisFailed = sessionStatus === "error" || eventStatus === "error";
  const safeSessions =
    sessionTrends?.stateDistribution.find((s) => s.state === "AWAKE")?.count ?? 0;
  const kpis = kpisReady
    ? [
        {
          label: "Total Sessions",
          icon: "Layers",
          unit: "",
          value: sessionTrends.current.totalSessions,
          delta: deltaPercent(
            sessionTrends.current.totalSessions,
            sessionTrends.previous.totalSessions,
          ),
          goodDirection: "up",
        },
        {
          label: "Safe Sessions",
          icon: "ShieldCheck",
          unit: "",
          value: safeSessions,
          delta: null,
          goodDirection: "up",
        },
        {
          label: "Total Alerts",
          icon: "AlertTriangle",
          unit: "",
          value: sessionTrends.current.totalAlerts,
          delta: deltaPercent(
            sessionTrends.current.totalAlerts,
            sessionTrends.previous.totalAlerts,
          ),
          goodDirection: "down",
        },
        {
          label: "Total Events",
          icon: "Activity",
          unit: "",
          value: eventTrends.current.totalEvents,
          delta: deltaPercent(eventTrends.current.totalEvents, eventTrends.previous.totalEvents),
          goodDirection: "up",
        },
        {
          label: "Yawning Events",
          icon: "Wind",
          unit: "",
          value: eventTrends.current.yawningEvents,
          delta: deltaPercent(
            eventTrends.current.yawningEvents,
            eventTrends.previous.yawningEvents,
          ),
          goodDirection: "down",
        },
        {
          label: "Sleep Events",
          icon: "Moon",
          unit: "",
          value: eventTrends.current.sleepEvents,
          delta: deltaPercent(eventTrends.current.sleepEvents, eventTrends.previous.sleepEvents),
          goodDirection: "down",
        },
        {
          label: "Avg Fatigue",
          icon: "Gauge",
          unit: "%",
          value: sessionTrends.current.avgFatigueScore ?? 0,
          delta: deltaPercent(
            sessionTrends.current.avgFatigueScore,
            sessionTrends.previous.avgFatigueScore,
          ),
          goodDirection: "down",
        },
        {
          label: "Avg Confidence",
          icon: "Radar",
          unit: "%",
          value: eventTrends.current.avgConfidence ?? 0,
          delta: deltaPercent(
            eventTrends.current.avgConfidence,
            eventTrends.previous.avgConfidence,
          ),
          goodDirection: "up",
        },
        {
          label: "Avg Session",
          icon: "Clock",
          unit: "min",
          value: sessionTrends.current.avgDurationSeconds
            ? Math.round(sessionTrends.current.avgDurationSeconds / 60)
            : 0,
          delta: deltaPercent(
            sessionTrends.current.avgDurationSeconds,
            sessionTrends.previous.avgDurationSeconds,
          ),
          goodDirection: "up",
        },
        {
          label: "Eye Closure Time",
          icon: "Eye",
          unit: "s",
          value: Math.round(sessionTrends.current.totalEyeClosureSeconds),
          delta: deltaPercent(
            sessionTrends.current.totalEyeClosureSeconds,
            sessionTrends.previous.totalEyeClosureSeconds,
          ),
          goodDirection: "down",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Link to="/dashboard" className="hover:text-foreground">
              Cockpit
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Analytics</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 shadow-[0_0_20px_-4px_var(--color-primary)]">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Analytics Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                Your monitoring sessions, driver behavior, and AI model performance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-40 border-border/60 bg-card/60 text-xs">
              <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-border/60 bg-card/60 text-xs"
            onClick={() => setRefreshTick((t) => t + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() =>
              document.getElementById("reporting-center")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <div className="ml-1 flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1">
            <Avatar className="h-6 w-6 border border-primary/30">
              <AvatarFallback className="bg-primary/10 text-[10px] text-primary">AD</AvatarFallback>
            </Avatar>
            <div className="hidden text-xs sm:block">
              <div className="font-medium leading-none">Admin</div>
              <div className="text-[10px] text-muted-foreground">Analyst</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <Section title="Global KPIs" subtitle={`Real totals, last ${RANGE_DAYS[range] ?? 30} days`}>
        {kpisFailed ? (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {sessionError || eventError}
          </div>
        ) : !kpisReady ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/40 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading KPIs…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
            {kpis.map((k, i) => (
              <KPIStatCard key={k.label} kpi={k} delay={i * 0.03} />
            ))}
          </div>
        )}
      </Section>

      {/* Filters */}
      <FilterPanel severity={severity} onSeverityChange={setSeverity} />

      {/* Driver behavior */}
      <Section title="Driver Behavior" subtitle="Fatigue, attention, and physiological trends">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <AnalyticsChartCard
            title="Daily Fatigue Trend"
            subtitle={`Real data · last ${RANGE_DAYS[range] ?? 30} days · avg fatigue vs session count`}
          >
            {sessionStatus === "loading" ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : sessionStatus === "error" ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> {sessionError}
              </div>
            ) : dailyTrend.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                No sessions in this window yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyTrend}>
                  <defs>
                    <linearGradient id="fatG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-signal-danger)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-signal-danger)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="confG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="day" {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...TT} />
                  <Area
                    dataKey="fatigue"
                    name="Avg fatigue"
                    stroke="var(--color-signal-danger)"
                    fill="url(#fatG)"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="sessions"
                    name="Sessions"
                    stroke="var(--color-primary)"
                    fill="url(#confG)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard title="Weekly Fatigue" subtitle="Real data · 12-week rolling window">
            {weeklyStatus === "loading" ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : weeklyFatigue.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                No scored sessions in the last 12 weeks.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyFatigue}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="week" {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...TT} />
                  <Bar dataKey="fatigue" fill="var(--color-signal-drowsy)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard title="Avg EAR & MAR" subtitle="Real data · by hour of day">
            {eventStatus === "loading" ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : earMarData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                No eye/yawn evidence in this window yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={earMarData}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="h" {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...TT} />
                  <Line dataKey="ear" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  <Line
                    dataKey="mar"
                    stroke="var(--color-signal-drowsy)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Session Outcomes"
            subtitle="Real data · sessions by final classified state"
          >
            {sessionStatus === "loading" ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : !sessionTrends || sessionTrends.stateDistribution.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                No sessions in this window yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sessionTrends.stateDistribution.map((s) => ({
                      name: s.state,
                      value: s.count,
                    }))}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {sessionTrends.stateDistribution.map((s) => (
                      <Cell
                        key={s.state}
                        fill={STATE_COLORS[s.state] ?? "var(--color-muted-foreground)"}
                      />
                    ))}
                  </Pie>
                  <Tooltip {...TT} itemStyle={{ color: "var(--color-foreground)" }} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Yawning Frequency"
            subtitle="Real data · yawning events per day"
          >
            {eventStatus === "loading" ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : yawnFreqData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                No yawning events in this window yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yawnFreqData}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="day" {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...TT} />
                  <Bar dataKey="yawns" fill="var(--color-signal-drowsy)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard title="Cumulative Eye Closure" subtitle="Real data · seconds per day">
            {sessionStatus === "loading" ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : eyeClosureData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                No sessions in this window yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={eyeClosureData}>
                  <defs>
                    <linearGradient id="eyeG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="day" {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...TT} />
                  <Area
                    dataKey="seconds"
                    stroke="var(--color-chart-2)"
                    fill="url(#eyeG)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Session Duration"
            subtitle="Real data · most recent 100 sessions"
            className="xl:col-span-2"
          >
            {recentSessionsStatus === "loading" ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : recentSessions.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                No sessions yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sessionDurationBuckets}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="range" {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...TT} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>
        </div>
      </Section>

      {/* Alerts */}
      <Section title="Alert Analytics" subtitle="Frequency, severity, and temporal patterns">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <AnalyticsChartCard
            title="Alerts by Hour"
            subtitle={
              severity === "all"
                ? "Real data · warning / danger / emergency, per hour"
                : `Real data · ${severity.toLowerCase()} alerts, per hour`
            }
            className="lg:col-span-2"
          >
            {eventStatus === "loading" ? (
              <div className="flex h-[240px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={alertHourData}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="h" {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...TT} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                  {severity === "all" ? (
                    <>
                      <Bar dataKey="warning" stackId="a" fill="var(--color-signal-drowsy)" />
                      <Bar dataKey="danger" stackId="a" fill="var(--color-signal-danger)" />
                      <Bar
                        dataKey="emergency"
                        stackId="a"
                        fill="var(--color-signal-danger)"
                        radius={[4, 4, 0, 0]}
                      />
                    </>
                  ) : (
                    <Bar
                      dataKey={SEVERITY_BAR_KEY[severity]}
                      fill="var(--color-signal-drowsy)"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard title="Alert Severity Distribution" subtitle="Real event counts">
            {eventStatus === "loading" ? (
              <div className="flex h-[240px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : !eventTrends || eventTrends.alertLevelDistribution.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
                No events in this window yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={eventTrends.alertLevelDistribution.map((d) => ({
                      name: d.alertLevel,
                      value: d.count,
                    }))}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {eventTrends.alertLevelDistribution.map((d) => (
                      <Cell
                        key={d.alertLevel}
                        fill={ALERT_COLORS[d.alertLevel] ?? "var(--color-muted-foreground)"}
                      />
                    ))}
                  </Pie>
                  <Tooltip {...TT} itemStyle={{ color: "var(--color-foreground)" }} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard title="Alerts by Day" subtitle="Real data · weekly rhythm">
            {eventStatus === "loading" ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={alertsByDayData}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="d" {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...TT} />
                  <Line
                    dataKey="alerts"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Alert Heatmap"
            subtitle="Real data · day-of-week × hour intensity"
            className="lg:col-span-2"
          >
            {eventStatus === "loading" ? (
              <div className="flex h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : (
              <AlertHeatmap cells={eventTrends?.alertHeatmap ?? []} />
            )}
          </AnalyticsChartCard>
        </div>
      </Section>

      {/* AI Model Performance */}
      <Section
        title="AI Model Performance"
        subtitle={aiPerf ? aiPerf.checkpoint : "Held-out test-set evaluation"}
        icon={<Cpu className="h-4 w-4 text-primary" />}
      >
        <AIPerformanceCard aiPerf={aiPerf} error={aiPerfError} />
      </Section>

      {/* System health */}
      <Section title="System Health" subtitle="Real backend, database, storage and AI model state">
        {systemHealthError ? (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {systemHealthError}
          </div>
        ) : !systemHealth ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/40 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading system health…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <HealthCard
              item={{
                label: "Backend",
                value: systemHealth.backend === "online" ? "Online" : systemHealth.backend,
                status: systemHealth.backend === "online" ? "ok" : "warn",
                meta: "Process liveness",
                icon: "Server",
              }}
            />
            <HealthCard
              item={{
                label: "Database",
                value: systemHealth.database === "online" ? "Online" : systemHealth.database,
                status: systemHealth.database === "online" ? "ok" : "warn",
                meta: "Supabase PostgreSQL",
                icon: "Database",
              }}
            />
            <HealthCard
              item={{
                label: "Storage",
                value: systemHealth.storage === "online" ? "Online" : systemHealth.storage,
                status: systemHealth.storage === "online" ? "ok" : "warn",
                meta: "Supabase Storage",
                icon: "HardDrive",
              }}
            />
            <HealthCard
              item={{
                label: "AI Model",
                value: systemHealth.ai === "loaded" ? "Loaded" : systemHealth.ai,
                status: systemHealth.ai === "loaded" ? "ok" : "warn",
                meta: "Detector checkpoint",
                icon: "Zap",
              }}
            />
          </div>
        )}
      </Section>

      {/* Export center */}
      <Section
        title="Reporting Center"
        subtitle="Generate shareable artifacts from your real data"
        icon={<Download className="h-4 w-4 text-primary" />}
      >
        <div id="reporting-center">
          {sessionTrends && eventTrends ? (
            <ExportPanel sessionTrends={sessionTrends} eventTrends={eventTrends} />
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/40 p-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for data to export…
            </div>
          )}
        </div>
      </Section>

      <footer className="pt-4 pb-2 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        DriveAlert Cockpit · Analytics v2.0
      </footer>
    </div>
  );
}
function Section({ title, subtitle, icon, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-3"
    >
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
              {title}
            </h2>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="hidden items-center gap-1 text-[10px] text-muted-foreground md:flex">
          <ArrowUpRight className="h-3 w-3" />
          <span>Real data</span>
        </div>
      </div>
      {children}
    </motion.section>
  );
}
