import { motion } from "framer-motion";
import { AlertTriangle, Camera, Cpu, GitBranch, History } from "lucide-react";
import { SectionHeader } from "./Features";
const STEPS = [
  { icon: Camera, title: "Camera", desc: "Frames captured from webcam, dashcam, or upload." },
  { icon: Cpu, title: "AI Detection", desc: "YOLO model extracts eyes, mouth and head landmarks." },
  {
    icon: GitBranch,
    title: "Decision Engine",
    desc: "PERCLOS + FSM turn noisy signals into trusted states.",
  },
  {
    icon: AlertTriangle,
    title: "Alerts",
    desc: "Audio, push, email, WhatsApp — escalated by severity.",
  },
  {
    icon: History,
    title: "History",
    desc: "Every session archived for review, audit and training.",
  },
];
export function HowItWorks() {
  return (
    <section id="how" className="relative border-t border-border/60 py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          kicker="Pipeline"
          title="From pixel to alert in under 120 ms."
          subtitle="Five stages. Zero guesswork. Every millisecond accounted for."
        />

        <div className="relative mt-20">
          {/* connecting line */}
          <div className="absolute left-6 top-6 hidden h-[calc(100%-3rem)] w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent lg:left-1/2 lg:h-px lg:w-[calc(100%-3rem)] lg:top-8 lg:bg-gradient-to-r" />

          <div className="grid gap-6 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="text-metric text-xs font-semibold text-muted-foreground">
                    0{i + 1}
                  </div>
                </div>
                <h3 className="font-display text-base font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
