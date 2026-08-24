import { motion } from "framer-motion";
import { techStack } from "./data";
import { SectionShell } from "./SectionShell";
import { Boxes } from "lucide-react";
const TAG_COLORS = {
  Frontend: "text-primary border-primary/30 bg-primary/10",
  Backend: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  AI: "text-violet-300 border-violet-400/30 bg-violet-400/10",
  Data: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  Infra: "text-amber-300 border-amber-400/30 bg-amber-400/10",
};
export function TechnologyStack() {
  return (
    <SectionShell
      id="technology"
      eyebrow="Technology Stack"
      title="Best-in-class tools, chosen deliberately."
      intro="Every dependency earns its place by improving safety, speed, or developer velocity."
      tone="muted"
    >
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {techStack.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (i % 8) * 0.05, duration: 0.4 }}
            className="glass-panel group relative overflow-hidden rounded-xl border border-border/50 p-4 transition hover:border-primary/40 hover:shadow-[0_0_30px_-10px_var(--color-primary)]"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/60 text-primary transition group-hover:scale-110">
                <Boxes className="h-4 w-4" />
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${TAG_COLORS[t.tag]}`}
              >
                {t.tag}
              </span>
            </div>
            <div className="mt-3 font-display text-base font-semibold">{t.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.desc}</div>
            <div className="mt-3 border-t border-border/40 pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t.purpose}
            </div>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  );
}
