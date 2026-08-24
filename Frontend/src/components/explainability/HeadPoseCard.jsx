import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { headPoseSeries, decisionSummary } from "./mockData";
import { Compass } from "lucide-react";
function Gauge({ label, value, range = 45, color }) {
  const pct = ((value + range) / (range * 2)) * 100;
  return (
    <div className="glass-panel rounded-xl border border-border/50 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-lg font-semibold" style={{ color }}>
          {value.toFixed(0)}°
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted/40">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <div
          className="absolute inset-y-0 rounded-full transition-all"
          style={{
            left: `${Math.min(pct, 50)}%`,
            width: `${Math.abs(pct - 50)}%`,
            background: color,
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}
export function HeadPoseCard() {
  const forwardPct = 72;
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-2 text-purple-300">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Head Pose Analysis</h2>
            <p className="text-xs text-muted-foreground">Yaw · Pitch · Roll · Forward attention</p>
          </div>
        </div>
        <div className="hidden items-center gap-4 sm:flex">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Forward attention
            </div>
            <div className="font-mono text-sm font-semibold text-primary">{forwardPct}%</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Distraction
            </div>
            <div className="font-mono text-sm font-semibold text-amber-300">4m 12s</div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr,1.4fr]">
        <div className="space-y-3">
          <Gauge label="Yaw" value={decisionSummary.headPose.yaw} color="oklch(0.78 0.16 240)" />
          <Gauge
            label="Pitch"
            value={decisionSummary.headPose.pitch}
            color="oklch(0.82 0.16 140)"
          />
          <Gauge
            label="Roll"
            value={decisionSummary.headPose.roll}
            color="oklch(0.78 0.16 25)"
            range={30}
          />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={headPoseSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
              <XAxis dataKey="t" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="yaw"
                stroke="oklch(0.78 0.16 240)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="pitch"
                stroke="oklch(0.82 0.16 140)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="roll"
                stroke="oklch(0.78 0.16 25)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
