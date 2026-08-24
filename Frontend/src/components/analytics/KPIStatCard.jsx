import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Layers,
  Users,
  AlertTriangle,
  ShieldCheck,
  Eye,
  Moon,
  Wind,
  Gauge,
  Radar,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useEffect, useState } from "react";
const ICONS = {
  Layers,
  Users,
  AlertTriangle,
  ShieldCheck,
  Eye,
  Moon,
  Wind,
  Gauge,
  Radar,
  Clock,
  Activity,
};
function useCountUp(target, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}
/**
 * One real KPI card, with an optional "vs last period" delta.
 *
 * `kpi.delta` is `null` when the previous period had no baseline to compare
 * against (e.g. no sessions at all) - the comparison row is omitted rather
 * than showing a fabricated 0% or infinite change. `kpi.goodDirection`
 * ("up" | "down") says which direction is actually desirable for this
 * metric (e.g. more Safe Sessions is good, more Total Alerts is not), so
 * the arrow always reflects the real sign of the change while the color
 * reflects whether that change is good news.
 */
export function KPIStatCard({ kpi, delay = 0 }) {
  const Icon = ICONS[kpi.icon] ?? Layers;
  const val = useCountUp(kpi.value);
  const hasDelta = kpi.delta !== null && kpi.delta !== undefined;
  const positive = hasDelta && kpi.delta >= 0;
  const good = hasDelta ? positive === (kpi.goodDirection !== "down") : null;
  const toneColor = good ? "text-primary" : "text-amber-300";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="glass-panel group relative overflow-hidden border-border/50 p-4 transition-all hover:border-primary/40">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            {kpi.label}
          </span>
          <div className="grid h-7 w-7 place-items-center rounded-md border border-primary/25 bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-semibold text-foreground">
            {val.toLocaleString()}
          </span>
          {kpi.unit && <span className="text-xs text-muted-foreground">{kpi.unit}</span>}
        </div>
        {hasDelta ? (
          <div className={`mt-2 flex items-center gap-1 text-[11px] ${toneColor}`}>
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            <span className="font-mono">
              {kpi.delta > 0 ? "+" : ""}
              {kpi.delta}%
            </span>
            <span className="text-muted-foreground">vs last period</span>
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-muted-foreground">No prior-period data</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </Card>
    </motion.div>
  );
}
