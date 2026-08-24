import {
  AreaChart,
  Area,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { earSeries } from "./mockData";
import { Eye } from "lucide-react";
export function EARChart() {
  const min = Math.min(...earSeries.map((d) => d.ear));
  const avg = earSeries.reduce((a, b) => a + b.ear, 0) / earSeries.length;
  const lowEvents = earSeries.filter((d) => d.ear < 0.22).length;
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">EAR Analysis</h2>
            <p className="text-xs text-muted-foreground">
              Eye Aspect Ratio over time · threshold 0.22
            </p>
          </div>
        </div>
        <div className="hidden gap-6 sm:flex">
          <Stat label="Min EAR" value={min.toFixed(3)} />
          <Stat label="Avg EAR" value={avg.toFixed(3)} />
          <Stat label="Low events" value={String(lowEvents)} />
          <Stat label="Closure" value="1.8 s" />
        </div>
      </header>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={earSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="earFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
            <XAxis dataKey="t" stroke="var(--color-muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} domain={[0.1, 0.4]} />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <ReferenceLine
              y={0.22}
              stroke="var(--color-signal-danger)"
              strokeDasharray="4 4"
              label={{
                value: "Threshold",
                fill: "var(--color-signal-danger)",
                fontSize: 10,
                position: "right",
              }}
            />
            <Area
              type="monotone"
              dataKey="ear"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#earFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
