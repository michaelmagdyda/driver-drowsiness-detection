import { motion } from "framer-motion";
export function ProgressCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
        <span className="text-metric text-sm font-semibold text-foreground">{value}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted/40">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-primary/70"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-primary-foreground/25 to-transparent"
          animate={{ x: ["-100%", "400%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        />
      </div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
