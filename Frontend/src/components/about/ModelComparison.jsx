import { motion } from "framer-motion";
import { Check, X, TrendingUp } from "lucide-react";
import { models } from "./data";
import { SectionShell } from "./SectionShell";
import { cn } from "@/lib/utils";
const ACCENT = {
  primary: "border-primary/40 shadow-[0_0_40px_-14px_var(--color-primary)]",
  info: "border-sky-400/40 shadow-[0_0_40px_-14px_var(--color-chart-2)]",
  warning: "border-amber-400/40 shadow-[0_0_40px_-14px_var(--color-signal-drowsy)]",
};
export function ModelComparison() {
  return (
    <SectionShell
      id="models"
      eyebrow="AI Models"
      title="Three architectures, one benchmark."
      intro="We train, evaluate, and compare complementary detection families. YOLO ships to production; the rest keep it honest."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {models.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className={cn("glass-panel flex flex-col rounded-2xl border p-6", ACCENT[m.accent])}
          >
            <div className="flex items-center justify-between">
              <div className="font-display text-xl font-semibold">{m.name}</div>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{m.purpose}</div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {Object.entries(m.metrics).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {k}
                  </div>
                  <div className="font-mono text-lg font-semibold text-foreground">
                    {v}
                    {k === "fps" ? "" : "%"}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-widest text-emerald-300">
                Advantages
              </div>
              <ul className="mt-2 space-y-1.5">
                {m.advantages.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-widest text-rose-300">Limitations</div>
              <ul className="mt-2 space-y-1.5">
                {m.limitations.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-sm">
                    <X className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-300" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto border-t border-border/40 pt-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Roadmap
              </div>
              <div className="mt-1 text-xs text-foreground/90">{m.future}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  );
}
