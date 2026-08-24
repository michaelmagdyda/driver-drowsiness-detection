import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Clock, HeartPulse, Radar } from "lucide-react";
import { problemStats } from "./data";
import { SectionShell } from "./SectionShell";
const RISKS = [
  {
    icon: AlertTriangle,
    title: "Silent onset",
    desc: "Fatigue creeps in without conscious warning.",
  },
  { icon: Clock, title: "Reaction lag", desc: "Response times triple after 17 hours awake." },
  {
    icon: HeartPulse,
    title: "Human limits",
    desc: "Circadian dips make 2-5 AM the deadliest window.",
  },
  { icon: Radar, title: "No safety net", desc: "Standard cars don't watch the driver's state." },
];
export function ProblemStatement() {
  return (
    <SectionShell
      id="problem"
      eyebrow="The Problem"
      title="Fatigue is invisible — until it isn't."
      intro="Drowsy driving is one of the most under-reported causes of road fatalities. Drivers rarely realize how impaired they are before it's too late."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {problemStats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            <Card className="glass-panel h-full border-border/50 p-6">
              <div className="font-display text-4xl font-semibold text-primary md:text-5xl">
                {s.value}
              </div>
              <div className="mt-3 text-sm text-foreground/90">{s.label}</div>
              <div className="mt-4 border-t border-border/40 pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.source}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {RISKS.map((r, i) => (
          <motion.div
            key={r.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <r.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="font-display text-sm font-semibold">{r.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{r.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  );
}
