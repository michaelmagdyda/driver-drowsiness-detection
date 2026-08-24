import { motion } from "framer-motion";
import { Video, ScanFace, Eye, Sigma, Smile, Compass, Gauge, Bell, FileText } from "lucide-react";
import { workflowSteps } from "./data";
import { SectionShell } from "./SectionShell";
const ICONS = { Video, ScanFace, Eye, Sigma, Smile, Compass, Gauge, Bell, FileText };
export function WorkflowTimeline() {
  return (
    <SectionShell
      id="workflow"
      eyebrow="System Workflow"
      title="Ten steps, one heartbeat."
      intro="From raw pixels to a decision the driver can trust — each stage is measurable and inspectable."
    >
      <div className="relative">
        <div className="absolute left-6 top-0 h-full w-px bg-gradient-to-b from-primary/40 via-border to-transparent md:left-1/2" />
        <div className="space-y-6">
          {workflowSteps.map((step, i) => {
            const Icon = ICONS[step.icon] ?? Gauge;
            const left = i % 2 === 0;
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5 }}
                className={`relative flex flex-col md:flex-row ${left ? "md:justify-start" : "md:justify-end"}`}
              >
                <div
                  className={`glass-panel relative ml-14 w-full rounded-2xl border border-border/50 p-5 md:ml-0 md:w-[46%] ${left ? "md:mr-auto md:pr-6" : "md:ml-auto md:pl-6"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      Step {String(step.n).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="mt-3 font-display text-lg font-semibold">{step.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{step.desc}</div>
                </div>
                <div className="absolute left-6 top-6 -translate-x-1/2 md:left-1/2">
                  <div className="h-3 w-3 rounded-full border-2 border-primary bg-background shadow-[0_0_16px_-2px_var(--color-primary)]" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}
