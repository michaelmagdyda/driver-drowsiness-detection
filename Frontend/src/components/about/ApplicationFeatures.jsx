import { motion } from "framer-motion";
import {
  Radio,
  Camera,
  Video,
  Image as ImageIcon,
  Bell,
  BarChart3,
  History,
  FileText,
  Brain,
  ShieldCheck,
} from "lucide-react";
import { features } from "./data";
import { SectionShell } from "./SectionShell";
const ICONS = {
  Radio,
  Camera,
  Video,
  Image: ImageIcon,
  Bell,
  BarChart3,
  History,
  FileText,
  Brain,
  ShieldCheck,
};
export function ApplicationFeatures() {
  return (
    <SectionShell
      id="features"
      eyebrow="Application Features"
      title="A complete safety cockpit, not a demo."
      intro="Every screen in DriveAlert is production-quality — from live monitoring to fleet analytics."
      tone="muted"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => {
          const Icon = ICONS[f.icon] ?? Radio;
          return (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 6) * 0.05, duration: 0.4 }}
              className="glass-panel group relative overflow-hidden rounded-xl border border-border/50 p-5 transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="relative mb-4 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background/60 to-card/50">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }}
                />
                <Icon className="relative h-10 w-10 text-primary transition group-hover:scale-110" />
              </div>
              <div className="font-display text-base font-semibold">{f.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.desc}</div>
            </motion.div>
          );
        })}
      </div>
    </SectionShell>
  );
}
