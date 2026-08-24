import { motion } from "framer-motion";
import { useState } from "react";
import { temporalEvents } from "./mockData";
import { Clock } from "lucide-react";
export function TemporalAnalysis() {
  const [active, setActive] = useState(3);
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Temporal Analysis</h2>
            <p className="text-xs text-muted-foreground">
              How the decision evolved over time — click any node to inspect.
            </p>
          </div>
        </div>
      </header>

      <div className="relative">
        <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-primary/60 via-border to-red-500/60 md:left-1/2 md:-translate-x-1/2" />
        <ol className="space-y-4">
          {temporalEvents.map((e, i) => (
            <motion.li
              key={e.frame}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className={`relative grid gap-3 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:col-start-2" : ""}`}
            >
              <button
                onClick={() => setActive(i)}
                className={`glass-panel ml-10 rounded-xl border p-3 text-left transition md:ml-0 ${active === i ? "border-primary/60 shadow-[0_0_30px_-10px_var(--color-primary)]" : "border-border/50 hover:border-border"} ${i % 2 ? "md:mr-4" : "md:ml-4"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Frame {e.frame}
                  </span>
                  <span className="rounded-full border border-border/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    t+{(e.frame / 30).toFixed(1)}s
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold">{e.label}</div>
                <div className="text-xs text-muted-foreground">{e.detail}</div>
              </button>
              <span
                className={`absolute left-4 top-4 h-3 w-3 -translate-x-1/2 rounded-full border-2 md:left-1/2 ${active === i ? "border-primary bg-primary shadow-[0_0_16px_2px_var(--color-primary)]" : "border-border bg-card"}`}
              />
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
