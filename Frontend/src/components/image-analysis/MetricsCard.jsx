import { motion } from "framer-motion";
export function MetricsCard({ label, value, unit, icon: Icon, tone, hint, delay = 0 }) {
  const c = tone ?? "var(--color-signal-awake)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        <div
          className="grid h-6 w-6 place-items-center rounded-md"
          style={{ backgroundColor: `${c}20`, color: c }}
        >
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <div className="text-metric text-2xl font-semibold">{value}</div>
        {unit && <div className="text-xs text-muted-foreground">{unit}</div>}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </motion.div>
  );
}
