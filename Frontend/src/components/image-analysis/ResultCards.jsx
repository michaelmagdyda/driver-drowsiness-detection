import { motion } from "framer-motion";
import { Sparkles, Clock } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
const STATUS_COLOR = {
  Awake: "var(--color-signal-awake)",
  Yawning: "var(--color-signal-drowsy)",
  Drowsy: "var(--color-signal-drowsy)",
  Sleeping: "var(--color-signal-danger)",
  Unknown: "var(--color-muted-foreground)",
};
export function SummaryCard({ data }) {
  const color = STATUS_COLOR[data.driverStatus];
  return (
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
              Analyzed in {data.processingMs} ms · {data.resolution}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Confidence
          </div>
          <div className="text-metric text-4xl font-semibold" style={{ color }}>
            {(data.confidence * 100).toFixed(1)}
            <span className="ml-1 text-base text-muted-foreground">%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
const LABEL_DISPLAY = { closed_eye: "Closed eye", open_eye: "Open eye", yawn: "Yawn" };
export function DetectionBreakdown({ data }) {
  const byLabel = {};
  for (const det of data.detections ?? []) {
    const bucket = byLabel[det.label] ?? [];
    bucket.push(det.score);
    byLabel[det.label] = bucket;
  }
  const rows = Object.keys(LABEL_DISPLAY).map((label) => {
    const scores = byLabel[label] ?? [];
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { name: LABEL_DISPLAY[label], conf: avg, count: scores.length };
  });
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-display text-sm font-semibold">Detection breakdown</div>
          <div className="text-[11px] text-muted-foreground">
            Average confidence per detected class ({data.detections?.length ?? 0} box
            {data.detections?.length === 1 ? "" : "es"})
          </div>
        </div>
      </div>
      <div className="h-44">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="name"
              stroke="var(--color-muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--color-muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={[0, 1]}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => `${(v * 100).toFixed(1)}%`}
            />
            <Bar dataKey="conf" radius={[6, 6, 0, 0]} fill="var(--color-primary)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export function DecisionSummary({ data }) {
  const rules = [
    { label: "Eyes closed", pass: data.eyesClosed, weight: "High" },
    { label: "Yawning detected", pass: data.yawning, weight: "Medium" },
    { label: "EAR proxy < 0.22", pass: data.ear != null && data.ear < 0.22, weight: "High" },
    { label: "MAR proxy > 0.45", pass: data.mar != null && data.mar > 0.45, weight: "Low" },
    {
      label: "Alert level ≥ Danger",
      pass: data.alertLevel === "DANGER" || data.alertLevel === "EMERGENCY",
      weight: "Medium",
    },
  ];
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
      <div className="mb-3">
        <div className="font-display text-sm font-semibold">AI decision summary</div>
        <div className="text-[11px] text-muted-foreground">Rules that fired for this frame</div>
      </div>
      <ul className="space-y-2">
        {rules.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${r.pass ? "bg-primary shadow-[0_0_8px_var(--color-primary)]" : "bg-muted-foreground/40"}`}
              />
              <span className={r.pass ? "text-foreground" : "text-muted-foreground"}>
                {r.label}
              </span>
            </div>
            <span className="text-metric text-[10px] uppercase tracking-widest text-muted-foreground">
              {r.weight}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
