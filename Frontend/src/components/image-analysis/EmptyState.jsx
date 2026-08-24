import { motion } from "framer-motion";
import { ImageIcon, UploadCloud, Cpu, ScanFace, Download } from "lucide-react";
const STEPS = [
  { icon: UploadCloud, label: "Upload an image", desc: "Drop a driver photo or browse from disk." },
  {
    icon: Cpu,
    label: "Wait for AI analysis",
    desc: "Model detects face, eyes, mouth and head pose.",
  },
  {
    icon: ScanFace,
    label: "Review detection",
    desc: "Inspect landmarks, confidence and fatigue score.",
  },
  { icon: Download, label: "Download results", desc: "Export processed image, PDF, JSON or CSV." },
];
export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 p-8 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in_oklch,var(--color-primary)_8%,transparent),transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-6 text-center">
        <div className="relative">
          <div className="grid h-24 w-24 place-items-center rounded-3xl border border-primary/40 bg-primary/10 shadow-[0_0_60px_-12px_var(--color-primary)]">
            <ScanFace className="h-10 w-10 text-primary" />
          </div>
          <div className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-xl border border-primary/40 bg-background text-primary">
            <ImageIcon className="h-4 w-4" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="font-display text-xl font-semibold tracking-tight">
            Analyze a driver image
          </div>
          <div className="max-w-md text-sm text-muted-foreground">
            Upload a photo to run drowsiness detection. Every landmark, metric and confidence score
            will appear here alongside a downloadable report.
          </div>
        </div>

        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="rounded-xl border border-border/60 bg-background/40 p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
                  <s.icon className="h-3 w-3" />
                </div>
                <span className="text-metric text-[10px] uppercase tracking-widest text-muted-foreground">
                  Step {i + 1}
                </span>
              </div>
              <div className="mt-2 text-sm font-medium">{s.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
