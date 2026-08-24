import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { confidenceHistory, confidenceDistribution } from "./mockData";
import { Target } from "lucide-react";
const calibration = Array.from({ length: 11 }, (_, i) => ({
  x: i / 10,
  y: Math.min(1, i / 10 + (Math.random() - 0.5) * 0.06),
  ideal: i / 10,
}));
export function ConfidenceAnalysis() {
  const conf = 0.912;
  const dash = 2 * Math.PI * 42;
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-5 flex items-center gap-2">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Confidence Analysis</h2>
          <p className="text-xs text-muted-foreground">
            Prediction confidence, distribution, and calibration.
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-4">
        <div className="glass-panel flex flex-col items-center justify-center rounded-xl border border-border/50 p-4">
          <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="8"
              strokeDasharray={dash}
              strokeDashoffset={dash * (1 - conf)}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 6px var(--color-primary))" }}
            />
          </svg>
          <div className="-mt-24 font-mono text-2xl font-bold text-primary">
            {(conf * 100).toFixed(1)}%
          </div>
          <div className="mt-16 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Prediction
          </div>
          <div className="mt-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase text-amber-200">
            Uncertainty ±3.4%
          </div>
        </div>

        <div className="glass-panel h-48 rounded-xl border border-border/50 p-3 lg:col-span-1">
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Distribution
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={confidenceDistribution}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
              <XAxis dataKey="bucket" stroke="var(--color-muted-foreground)" fontSize={9} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={9} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel h-48 rounded-xl border border-border/50 p-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            History
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={confidenceHistory}>
              <defs>
                <linearGradient id="cfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={[0.5, 1]} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="conf"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#cfill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel h-48 rounded-xl border border-border/50 p-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Calibration
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={calibration}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
              <XAxis dataKey="x" stroke="var(--color-muted-foreground)" fontSize={9} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={9} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="var(--color-muted-foreground)"
                strokeDasharray="3 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="y"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
