import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Camera,
  Eye,
  History,
  Image as ImageIcon,
  Radar,
  Video,
} from "lucide-react";
const FEATURES = [
  {
    icon: Camera,
    title: "Real-Time Monitoring",
    desc: "Live webcam and dashcam capture at 30 FPS with sub-frame precision.",
  },
  {
    icon: Eye,
    title: "AI Detection",
    desc: "YOLO-based vision model trained specifically on driver states.",
  },
  {
    icon: Activity,
    title: "EAR & MAR Analysis",
    desc: "Eye-aspect and mouth-aspect ratios drive our fatigue index.",
  },
  {
    icon: Radar,
    title: "Head Pose Detection",
    desc: "Pitch, yaw, and roll expose nodding-off before it becomes danger.",
  },
  {
    icon: AlertTriangle,
    title: "Instant Alerts",
    desc: "Escalating audio, email, and WhatsApp — only when the signal is real.",
  },
  {
    icon: History,
    title: "Detection History",
    desc: "Every session, event, and alert preserved for review and training.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    desc: "PERCLOS, fatigue trends, and per-driver behavior over time.",
  },
  {
    icon: ImageIcon,
    title: "Upload Images",
    desc: "Batch analyze photographs with the same model as live streams.",
  },
  {
    icon: Video,
    title: "Upload Videos",
    desc: "Process recorded footage and receive a full annotated report.",
  },
];
export function Features() {
  return (
    <section id="features" className="relative border-t border-border/60 py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          kicker="Capabilities"
          title="Everything the vehicle needs to see."
          subtitle="A calm, precise safety copilot — engineered as an instrument, not a dashboard."
        />

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl transition-colors hover:border-primary/40"
            >
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-base font-semibold text-card-foreground">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
export function SectionHeader({ kicker, title, subtitle }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-5xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-base text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
