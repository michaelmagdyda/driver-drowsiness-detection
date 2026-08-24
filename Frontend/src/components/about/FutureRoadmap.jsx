import { motion } from "framer-motion";
import { Rocket } from "lucide-react";
import { roadmap } from "./data";
import { SectionShell } from "./SectionShell";
export function FutureRoadmap() {
  return (
    <SectionShell
      id="roadmap"
      eyebrow="Future Roadmap"
      title="What comes after graduation."
      intro="The cockpit becomes a platform: fleets, edge devices, and multi-modal intelligence."
      tone="muted"
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {roadmap.map((r, i) => (
          <motion.div
            key={r.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (i % 6) * 0.05, duration: 0.4 }}
            className="glass-panel relative rounded-2xl border border-border/50 p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Rocket className="h-4 w-4" />
              </div>
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                {r.tag}
              </span>
            </div>
            <div className="mt-4 font-display text-base font-semibold">{r.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{r.desc}</div>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  );
}
