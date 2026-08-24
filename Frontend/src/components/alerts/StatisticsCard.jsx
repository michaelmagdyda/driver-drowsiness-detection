import { Card } from "@/components/ui/card";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
const TONE = {
  primary: "border-primary/30 text-primary bg-primary/10",
  danger: "border-red-500/30 text-red-400 bg-red-500/10",
  warning: "border-amber-400/30 text-amber-300 bg-amber-400/10",
  info: "border-sky-400/30 text-sky-300 bg-sky-400/10",
  muted: "border-border/60 text-muted-foreground bg-muted/20",
};
export function StatisticsCard({ label, value, suffix, icon: Icon, trend, tone = "primary" }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: "easeOut" });
    return () => controls.stop();
  }, [value, mv]);
  return (
    <Card className="glass-panel relative overflow-hidden border-border/50 p-4">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${TONE[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        {typeof trend === "number" && (
          <div
            className={`flex items-center gap-1 font-mono text-[10px] ${trend >= 0 ? "text-primary" : "text-red-400"}`}
          >
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <motion.span className="font-display text-2xl font-semibold tracking-tight">
          {rounded}
        </motion.span>
        {suffix && <span className="font-mono text-xs text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </Card>
  );
}
