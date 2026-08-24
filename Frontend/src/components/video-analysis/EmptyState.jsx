import { motion } from "framer-motion";
import { UploadCloud, Settings2, Play, LineChart, Download } from "lucide-react";
const STEPS = [
  {
    icon: UploadCloud,
    title: "Upload driving video",
    desc: "Drop MP4, AVI, MOV or MKV files up to 500 MB.",
  },
  {
    icon: Settings2,
    title: "Configure sampling",
    desc: "Pick how many frames per second are sent to the model.",
  },
  {
    icon: Play,
    title: "Start analysis",
    desc: "Sampled frames run through the same detector as Image Analysis.",
  },
  {
    icon: LineChart,
    title: "Review AI results",
    desc: "Explore per-frame metrics, events and analytics.",
  },
  {
    icon: Download,
    title: "Export results",
    desc: "Download the real analysis as JSON, CSV or a log.",
  },
];
export function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 p-6 backdrop-blur-xl sm:p-10">
      <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative">
        <div className="max-w-2xl">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            Video analysis
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Turn a driving recording into a full fatigue report
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Upload a clip, configure the pipeline, and get frame-accurate detections, event
            timelines and downloadable reports — all without leaving your cockpit.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-border/60 bg-background/40 p-4 backdrop-blur"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <s.icon className="h-3.5 w-3.5" />
                </div>
                <div className="text-metric text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Step {i + 1}
                </div>
              </div>
              <div className="mt-3 text-sm font-medium">{s.title}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
