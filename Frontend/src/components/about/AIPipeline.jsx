import { motion } from "framer-motion";
import {
  Radio,
  Sparkles,
  ScanFace,
  Layers,
  Cpu,
  Waves,
  Brain,
  Bell,
  FileText,
  ChevronRight,
} from "lucide-react";
import { pipeline } from "./data";
import { SectionShell } from "./SectionShell";
const ICONS = { Radio, Sparkles, ScanFace, Layers, Cpu, Waves, Brain, Bell, FileText };
export function AIPipeline() {
  return (
    <SectionShell
      id="pipeline"
      eyebrow="AI Pipeline"
      title="From raw frame to decision, in milliseconds."
      intro="A composable pipeline where every stage can be swapped, benchmarked, and explained."
      tone="muted"
    >
      <div className="glass-panel rounded-2xl border border-border/50 p-6 md:p-8">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-9">
          {pipeline.map((p, i) => {
            const Icon = ICONS[p.icon] ?? Cpu;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="relative rounded-xl border border-border/60 bg-background/40 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="font-display text-sm font-semibold">{p.title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{p.desc}</div>
                {i < pipeline.length - 1 && (
                  <ChevronRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-primary/60 lg:block" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}
