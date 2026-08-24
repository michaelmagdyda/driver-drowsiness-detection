import {
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { marSeries } from "./mockData";
import { MessageSquare } from "lucide-react";
export function MARChart() {
  const max = Math.max(...marSeries.map((d) => d.mar));
  const avg = marSeries.reduce((a, b) => a + b.mar, 0) / marSeries.length;
  const yawns = marSeries.filter((d) => d.mar > 0.55).length;
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">MAR Analysis</h2>
            <p className="text-xs text-muted-foreground">
              Mouth Aspect Ratio · yawn detection at 0.55
            </p>
          </div>
        </div>
        <div className="hidden gap-6 sm:flex">
          <S label="Yawns" v={String(yawns)} />
          <S label="Avg MAR" v={avg.toFixed(3)} />
          <S label="Max MAR" v={max.toFixed(3)} />
          <S label="Open dur." v="0.9 s" />
        </div>
      </header>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={marSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
            <XAxis dataKey="t" stroke="var(--color-muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} domain={[0.2, 0.75]} />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <ReferenceLine
              y={0.55}
              stroke="var(--color-signal-danger)"
              strokeDasharray="4 4"
              label={{
                value: "Yawn",
                fill: "var(--color-signal-danger)",
                fontSize: 10,
                position: "right",
              }}
            />
            <Line
              type="monotone"
              dataKey="mar"
              stroke="var(--color-signal-drowsy)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
function S({ label, v }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{v}</div>
    </div>
  );
}
