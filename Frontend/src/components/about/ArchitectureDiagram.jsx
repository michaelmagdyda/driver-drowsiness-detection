import { motion } from "framer-motion";
import { architecture } from "./data";
import { SectionShell } from "./SectionShell";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
const TONE = {
  primary: "border-primary/40 bg-primary/10 text-primary",
  info: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
};
export function ArchitectureDiagram() {
  return (
    <SectionShell
      id="architecture"
      eyebrow="System Architecture"
      title="Five layers, one contract."
      intro="A tiered architecture that separates concerns cleanly — from browser capture to GPU inference to durable storage."
    >
      <div className="space-y-3">
        {architecture.map((layer, i) => (
          <div key={layer.tier}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="glass-panel rounded-2xl border border-border/50 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="md:w-56">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Tier {i + 1}
                  </div>
                  <div className="mt-1 font-display text-lg font-semibold">{layer.tier}</div>
                </div>
                <div className="grid flex-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {layer.nodes.map((n) => (
                    <div
                      key={n}
                      className={cn(
                        "rounded-xl border bg-background/50 px-4 py-3 text-sm font-medium",
                        TONE[layer.color],
                      )}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
            {i < architecture.length - 1 && (
              <div className="flex justify-center py-1.5">
                <ArrowDown className="h-4 w-4 text-primary/60" />
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
