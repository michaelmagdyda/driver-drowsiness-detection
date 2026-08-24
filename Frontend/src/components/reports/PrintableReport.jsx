import { DetectionTimeline } from "@/components/history/DetectionTimeline";
import { ReplayPlayer } from "@/components/history/ReplayPlayer";
import { formatDuration } from "@/components/history/mockData";

// Same real event -> timeline-entry mapping history.jsx uses, duplicated
// here rather than imported from a route module.
const TIMELINE_SEVERITY = {
  SAFE: "info",
  WARNING: "medium",
  DANGER: "high",
  EMERGENCY: "critical",
};
function eventToTimelineEntry(event) {
  const type = event.yawning
    ? "yawn"
    : event.eyeClosed
      ? "eyes-closed"
      : event.state === "SLEEPING"
        ? "sleep"
        : event.alertLevel !== "SAFE"
          ? "warning"
          : "recovered";
  const label =
    {
      yawn: "Yawn detected",
      "eyes-closed": "Eyes closed",
      sleep: "Driver classified sleeping",
      warning: `Alert level: ${event.alertLevel}`,
      recovered: `State: ${event.state}`,
    }[type] ?? event.state;
  return {
    t: new Date(event.ts).toLocaleTimeString(),
    type,
    label,
    severity: TIMELINE_SEVERITY[event.alertLevel] ?? "info",
  };
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export const REPORT_SECTIONS = [
  { key: "summary", label: "Session Summary" },
  { key: "fatigue", label: "Fatigue & Alerts" },
  { key: "timeline", label: "Detection Timeline" },
  { key: "replay", label: "Recording / Image Replay" },
];

/**
 * A real, document-styled compilation of one session's already-fetched real
 * data (`getSession` + `listSessionEvents`). Shown on-screen as the live
 * preview and, via the `#printable-report` id + the `@media print` rule in
 * `styles.css`, is the only thing `window.print()` actually prints - a
 * genuine browser-generated PDF, not a fabricated report pipeline.
 */
export function PrintableReport({ session, events, sections }) {
  const has = (key) => sections.includes(key);
  const earValues = events.map((e) => e.ear).filter((v) => v != null);
  const marValues = events.map((e) => e.mar).filter((v) => v != null);
  const avgEar = mean(earValues);
  const avgMar = mean(marValues);
  const severityCounts = events.reduce((acc, e) => {
    acc[e.alertLevel] = (acc[e.alertLevel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      id="printable-report"
      className="space-y-6 rounded-2xl border border-border/60 bg-background p-6 text-foreground"
    >
      <div className="border-b border-border/40 pb-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          DriveAlert · Session Report
        </div>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
          Session {session.id.slice(0, 8)}
        </h2>
        <div className="mt-1 text-xs text-muted-foreground">
          Source: {session.source} · Status: {session.status} · Started{" "}
          {new Date(session.startedAt).toLocaleString()}
          {session.endedAt && ` · Ended ${new Date(session.endedAt).toLocaleString()}`}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          Generated {new Date().toLocaleString()}
        </div>
      </div>

      {has("summary") && (
        <section>
          <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Session Summary
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReportStat label="Final state" value={session.finalState ?? "—"} />
            <ReportStat label="Alert level" value={session.alertLevel ?? "—"} />
            <ReportStat
              label="Peak fatigue"
              value={session.maxFatigueScore != null ? `${session.maxFatigueScore}%` : "—"}
            />
            <ReportStat
              label="Duration"
              value={
                session.durationSeconds != null ? formatDuration(session.durationSeconds) : "—"
              }
            />
            <ReportStat label="Total events" value={String(session.totalEvents)} />
            <ReportStat label="Total alerts" value={String(session.totalAlerts)} />
            <ReportStat label="Yawns" value={String(session.yawnCount)} />
            <ReportStat label="Eyes closed" value={`${session.eyeClosureSeconds.toFixed(1)}s`} />
          </div>
        </section>
      )}

      {has("fatigue") && (
        <section>
          <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Fatigue & Alerts
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReportStat
              label="Avg EAR proxy"
              value={avgEar != null ? avgEar.toFixed(3) : "No eye evidence"}
            />
            <ReportStat
              label="Avg MAR proxy"
              value={avgMar != null ? avgMar.toFixed(3) : "No yawn evidence"}
            />
            <ReportStat label="Safe events" value={String(severityCounts.SAFE ?? 0)} />
            <ReportStat label="Warning events" value={String(severityCounts.WARNING ?? 0)} />
            <ReportStat label="Danger events" value={String(severityCounts.DANGER ?? 0)} />
            <ReportStat label="Emergency events" value={String(severityCounts.EMERGENCY ?? 0)} />
          </div>
        </section>
      )}

      {has("replay") && (
        <section>
          <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Recording / Image Replay
          </h3>
          <div className="print:hidden">
            <ReplayPlayer session={session} events={events} />
          </div>
          <p className="hidden text-xs text-muted-foreground print:block">
            {session.media
              ? "Recording available in Detection History — not included in the printed/PDF export."
              : "No recording available for this session."}
          </p>
        </section>
      )}

      {has("timeline") && (
        <section>
          <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Detection Timeline
          </h3>
          <DetectionTimeline events={events.map(eventToTimelineEntry)} />
        </section>
      )}
    </div>
  );
}
function ReportStat({ label, value }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
