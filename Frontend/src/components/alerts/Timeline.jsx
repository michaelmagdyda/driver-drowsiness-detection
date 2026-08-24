import { motion } from "framer-motion";
import { SeverityDot } from "./SeverityBadge";
export function Timeline({ events }) {
  return (
    <div className="relative pl-5">
      <div className="absolute left-2 top-1 bottom-1 w-px bg-gradient-to-b from-primary/40 via-border/60 to-transparent" />
      <div className="space-y-2.5">
        {events.map((e, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 p-2.5"
          >
            <div className="absolute -left-[17px] flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border/60 bg-background">
              <SeverityDot severity={e.severity} />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {e.t}
            </div>
            <div className="text-xs">{e.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
