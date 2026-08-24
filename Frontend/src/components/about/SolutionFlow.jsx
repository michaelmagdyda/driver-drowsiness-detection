import { motion } from "framer-motion";
import { User, Video, Cpu, Gauge, Bell, FileText, ShieldCheck, ArrowRight } from "lucide-react";
import { SectionShell } from "./SectionShell";
const FLOW = [
  { icon: User, label: "Driver" },
  { icon: Video, label: "Camera" },
  { icon: Cpu, label: "AI Detection" },
  { icon: Gauge, label: "Fatigue Analysis" },
  { icon: Bell, label: "Alerts" },
  { icon: FileText, label: "Reports" },
  { icon: ShieldCheck, label: "Admin Dashboard" },
];
export function SolutionFlow() {
  return (
    <SectionShell
      id="solution"
      eyebrow="Our Solution"
      title="A closed-loop safety system, from cabin to cloud."
      intro="Every driver becomes a live signal. We turn cabin video into calibrated fatigue intelligence — with alerts, archives, and audits."
      tone="muted"
    >
      <div className="glass-panel rounded-2xl border border-border/50 p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-y-6">
          {FLOW.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_30px_-8px_var(--color-primary)]">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="text-center font-display text-xs font-medium">{s.label}</div>
              </motion.div>
              {i < FLOW.length - 1 && (
                <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
