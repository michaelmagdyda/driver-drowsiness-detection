import { motion } from "framer-motion";
const statusMap = {
  operational: {
    color: "text-primary",
    dot: "bg-primary shadow-[0_0_10px_var(--color-primary)]",
    label: "Operational",
  },
  degraded: {
    color: "text-warning",
    dot: "bg-warning shadow-[0_0_10px_hsl(45_85%_60%)]",
    label: "Degraded",
  },
  down: {
    color: "text-destructive",
    dot: "bg-destructive shadow-[0_0_10px_hsl(0_70%_60%)]",
    label: "Down",
  },
};
export function HealthStatusCard({ name, status, latency, uptime }) {
  const s = statusMap[status] ?? statusMap.operational;
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{name}</div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest">
          <motion.span
            className={`h-2 w-2 rounded-full ${s.dot}`}
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          <span className={s.color}>{s.label}</span>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-metric text-lg font-semibold">{latency}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Latency</div>
        </div>
        <div className="text-right">
          <div className="text-metric text-lg font-semibold">{uptime.toFixed(2)}%</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            30d Uptime
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/40">
        <div
          className={`h-full rounded-full ${status === "operational" ? "bg-primary" : status === "degraded" ? "bg-warning" : "bg-destructive"}`}
          style={{ width: `${uptime}%` }}
        />
      </div>
    </div>
  );
}
export function ResourceGauge({ name, used, unit, detail }) {
  const radius = 34;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (used / 100) * circ;
  const color = used > 80 ? "text-destructive" : used > 60 ? "text-warning" : "text-primary";
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
      <div className="relative h-20 w-20 flex-shrink-0">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={radius}
            strokeWidth="6"
            className="fill-none stroke-muted/40"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            strokeWidth="6"
            strokeLinecap="round"
            className={`fill-none ${color} transition-all`}
            stroke="currentColor"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-metric text-sm font-semibold">
          {used}
          {unit}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{name}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}
