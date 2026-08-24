import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Clock,
  Eye,
  Gauge,
  Timer,
  Zap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
const STATUS_COLOR = {
  Awake: "var(--color-signal-awake)",
  Yawning: "var(--color-signal-drowsy)",
  Drowsy: "oklch(0.75 0.18 55)",
  Sleeping: "var(--color-signal-danger)",
  Unknown: "var(--color-muted-foreground)",
};
export function ResultsSummary({ data }) {
  const color = STATUS_COLOR[data.driverStatus];
  const dur = formatDuration(data.sessionDurationSec);
  const cards = [
    {
      label: "Fatigue score",
      value: data.fatigueScore.toFixed(0),
      unit: "/100",
      icon: Gauge,
      tone: color,
    },
    { label: "Total yawns", value: String(data.totalYawns), icon: Zap },
    {
      label: "Longest eye closure",
      value: data.longestEyeClosureSec.toFixed(1),
      unit: "s",
      icon: Eye,
    },
    {
      label: "Average EAR",
      value: data.avgEar != null ? data.avgEar.toFixed(3) : "—",
      icon: Activity,
    },
    {
      label: "Average MAR",
      value: data.avgMar != null ? data.avgMar.toFixed(3) : "—",
      icon: Activity,
    },
    {
      label: "Avg. confidence",
      value: data.avgConfidence != null ? (data.avgConfidence * 100).toFixed(1) : "—",
      unit: data.avgConfidence != null ? "%" : undefined,
      icon: ShieldCheck,
    },
    { label: "Total alerts", value: String(data.totalAlerts), icon: AlertTriangle },
    { label: "Session duration", value: dur, icon: Timer },
  ];
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl"
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="grid h-14 w-14 place-items-center rounded-2xl border"
              style={{
                borderColor: `${color}80`,
                backgroundColor: `${color}18`,
                color,
                boxShadow: `0 0 40px -10px ${color}`,
              }}
            >
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Driver status
              </div>
              <div className="font-display text-2xl font-semibold" style={{ color }}>
                {data.driverStatus}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {dur} analyzed · {data.totalAlerts} alerts triggered
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Fatigue score
            </div>
            <div className="text-metric text-4xl font-semibold" style={{ color }}>
              {data.fatigueScore.toFixed(0)}
              <span className="ml-1 text-base text-muted-foreground">/ 100</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {c.label}
              </div>
              <div
                className="grid h-6 w-6 place-items-center rounded-md"
                style={{
                  backgroundColor: `${c.tone ?? "var(--color-signal-awake)"}20`,
                  color: c.tone ?? "var(--color-signal-awake)",
                }}
              >
                <c.icon className="h-3 w-3" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <div className="text-metric text-2xl font-semibold">{c.value}</div>
              {c.unit && <div className="text-xs text-muted-foreground">{c.unit}</div>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
