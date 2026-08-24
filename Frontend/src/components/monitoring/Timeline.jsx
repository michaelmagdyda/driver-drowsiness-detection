import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Eye, Zap, CheckCircle2, Moon } from "lucide-react";
const KIND = {
  yawn: { icon: Zap, color: "var(--color-signal-drowsy)", label: "Yawning" },
  "eye-closed": { icon: Eye, color: "oklch(0.75 0.18 55)", label: "Eyes closed" },
  sleep: { icon: Moon, color: "var(--color-signal-danger)", label: "Sleep warning" },
  drowsy: { icon: AlertTriangle, color: "oklch(0.75 0.18 55)", label: "Drowsy" },
  recovered: { icon: CheckCircle2, color: "var(--color-signal-awake)", label: "Recovered" },
};
export function Timeline({ events }) {
  return (
    <div className="relative">
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const meta = KIND[e.kind];
            const Icon = meta.icon;
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="relative flex items-center gap-3"
              >
                <div
                  className="relative z-10 grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border backdrop-blur"
                  style={{
                    borderColor: `${meta.color}60`,
                    backgroundColor: `${meta.color}15`,
                    color: meta.color,
                    boxShadow: `0 0 20px -4px ${meta.color}80`,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-card/40 px-3 py-2 backdrop-blur">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium">{e.label}</div>
                    <div className="text-metric text-[11px] text-muted-foreground">{e.time}</div>
                  </div>
                  <div
                    className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em]"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
