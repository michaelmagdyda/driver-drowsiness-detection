import { motion } from "framer-motion";
import { timeline } from "./data";
import { SectionShell } from "./SectionShell";
export function ProjectTimeline() {
  return (
    <SectionShell
      id="timeline"
      eyebrow="Project Timeline"
      title="Sixteen weeks, engineered."
      intro="From literature review to live demo — every phase leaves an artifact behind."
      tone="muted"
    >
      <div className="relative overflow-x-auto pb-4">
        <div className="min-w-[720px]">
          <div className="relative flex items-start">
            <div className="absolute left-6 right-6 top-6 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            {timeline.map((t, i) => (
              <motion.div
                key={t.phase}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="relative flex-1 px-2 text-center"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-background font-mono text-xs font-semibold text-primary shadow-[0_0_20px_-4px_var(--color-primary)]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="font-display text-sm font-semibold">{t.phase}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t.period}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">{t.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
