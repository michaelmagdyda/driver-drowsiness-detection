import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { results, perfSeries } from "./data";
import { SectionShell } from "./SectionShell";
function useCounter(target, duration = 1200) {
  const [n, setN] = useState(0);
  const start = useRef(null);
  useEffect(() => {
    let raf = 0;
    const step = (ts) => {
      if (start.current === null) start.current = ts;
      const p = Math.min(1, (ts - start.current) / duration);
      setN(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}
function Gauge({ value, unit, label }) {
  const n = useCounter(value);
  const isPct = unit === "%";
  const pct = isPct ? Math.min(100, value) : Math.min(100, (value / 60) * 100);
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="glass-panel rounded-2xl border border-border/50 p-5 text-center">
      <div className="relative mx-auto h-28 w-28">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} strokeWidth="8" className="fill-none stroke-border/60" />
          <circle
            cx="50"
            cy="50"
            r={r}
            strokeWidth="8"
            strokeLinecap="round"
            className="fill-none"
            style={{
              stroke: "var(--color-primary)",
              strokeDasharray: c,
              strokeDashoffset: off,
              transition: "stroke-dashoffset 1s",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-xl font-semibold tabular-nums">
            {isPct || unit === "ms" || unit === ""
              ? n.toFixed(unit === "%" ? 1 : 0)
              : Math.round(n)}
            <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
export function ResultsPerformance() {
  return (
    <SectionShell
      id="results"
      eyebrow="Results & Performance"
      title="Measured, not promised."
      intro="Benchmarks across our best model checkpoint. Real values will replace these placeholders after final evaluation."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {results.map((r) => (
          <Gauge key={r.label} value={r.value} unit={r.unit} label={r.label} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glass-panel mt-6 border-border/50 p-5">
          <div className="mb-3">
            <div className="font-display text-sm font-semibold">Training convergence</div>
            <div className="text-xs text-muted-foreground">
              Precision / recall / mAP across epochs.
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={perfSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="epoch"
                  tick={{
                    fontSize: 10,
                    fontFamily: "JetBrains Mono",
                    fill: "var(--color-muted-foreground)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 10,
                    fontFamily: "JetBrains Mono",
                    fill: "var(--color-muted-foreground)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0.5, 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="precision"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="recall"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="map"
                  stroke="var(--color-signal-drowsy)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>
    </SectionShell>
  );
}
