import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Radio,
  FileText,
  Bell,
  Video,
  Image as ImageIcon,
  Activity,
  HardDrive,
  Calendar,
} from "lucide-react";
import { overviewStats } from "./mockData";
import { cn } from "@/lib/utils";
const ICONS = {
  Radio,
  FileText,
  Bell,
  Video,
  Image: ImageIcon,
  Activity,
  HardDrive,
  Calendar,
};
const ACCENT = {
  primary: "text-primary border-primary/30 bg-primary/10",
  info: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  warning: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  success: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  muted: "text-muted-foreground border-border/60 bg-muted/20",
};
function useCounter(target, duration = 900) {
  const [n, setN] = useState(0);
  const start = useRef(null);
  useEffect(() => {
    let raf = 0;
    const step = (ts) => {
      if (start.current === null) start.current = ts;
      const p = Math.min(1, (ts - start.current) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}
function StatCard({ stat }) {
  const Icon = ICONS[stat.icon] ?? Activity;
  const n = useCounter(typeof stat.value === "number" ? stat.value : 0);
  return (
    <Card className="glass-panel border-border/50 p-4">
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border",
            ACCENT[stat.accent] ?? ACCENT.primary,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">total</span>
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold tabular-nums">
        {n.toLocaleString()}
        {stat.unit && <span className="ml-1 text-sm text-muted-foreground">{stat.unit}</span>}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{stat.label}</div>
    </Card>
  );
}
export function StatisticsCard() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {overviewStats.map((s) => (
        <StatCard key={s.label} stat={s} />
      ))}
    </div>
  );
}
