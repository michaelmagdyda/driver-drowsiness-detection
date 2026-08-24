import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useEffect, useState } from "react";
export function AdminOverviewCard({ label, value, delta, trend, Icon, index = 0 }) {
  const numeric = typeof value === "number";
  const [display, setDisplay] = useState(numeric ? 0 : value);
  useEffect(() => {
    if (!numeric) return;
    const target = value;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, numeric]);
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendClass =
    trend === "up"
      ? "text-primary"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl transition-colors hover:border-primary/40"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-80" />
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className={`flex items-center gap-1 text-[11px] font-medium ${trendClass}`}>
          <TrendIcon className="h-3 w-3" />
          {delta}
        </div>
      </div>
      <div className="mt-5">
        <div className="text-metric text-3xl font-semibold tracking-tight">
          {typeof display === "number" ? display.toLocaleString() : display}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
      </div>
    </motion.div>
  );
}
