import { motion } from "framer-motion";
import { pipelineStages } from "./mockData";
import { Workflow } from "lucide-react";
export function PipelineDiagram() {
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-6 flex items-center gap-2">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <Workflow className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">AI Pipeline</h2>
          <p className="text-xs text-muted-foreground">
            End-to-end flow from camera to dashboard — pulses indicate live data.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {pipelineStages.map((s, i) => (
          <div key={s} className="flex items-center">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel relative rounded-lg border border-border/50 px-3 py-2"
            >
              <span className="font-mono text-[11px] tracking-widest text-foreground/90">{s}</span>
              <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
            </motion.div>
            {i < pipelineStages.length - 1 && (
              <div className="mx-1 h-px w-5 flex-shrink-0 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
