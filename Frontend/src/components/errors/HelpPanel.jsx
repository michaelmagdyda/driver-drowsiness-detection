import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
export function HelpPanel({ tips }) {
  if (!tips?.length) return null;
  return (
    <div className="mt-6 rounded-xl border border-border/60 bg-card/50 p-4 text-left backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        <Lightbulb className="h-3.5 w-3.5 text-signal-drowsy" />
        Helpful tips
      </div>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {tips.map((t, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="flex gap-2"
          >
            <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-primary/70" />
            <span>{t}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
