import { motion } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";
const STAGES = [
  { key: "uploading", label: "Uploading" },
  { key: "decoding", label: "Decoding frames" },
  { key: "inference", label: "Running AI model" },
  { key: "scoring", label: "Fatigue scoring" },
  { key: "reporting", label: "Building reports" },
];
export function ProcessingStatus({ stage, progress, framesProcessed, totalFrames, etaSeconds }) {
  const currentIndex = STAGES.findIndex((s) => s.key === stage);
  const eta =
    etaSeconds > 60
      ? `${Math.floor(etaSeconds / 60)}m ${Math.round(etaSeconds % 60)}s`
      : `${Math.max(0, Math.round(etaSeconds))}s`;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="flex items-center gap-3">
        <div className="relative grid h-11 w-11 place-items-center rounded-xl border border-primary/40 bg-primary/10">
          {stage === "done" ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
        </div>
        <div className="flex-1">
          <div className="font-display text-base font-semibold tracking-tight">
            {stage === "done" ? "Analysis complete" : "Analyzing your video"}
          </div>
          <div className="text-xs text-muted-foreground">
            {stage === "done"
              ? "Results and reports are ready below."
              : `Stage: ${STAGES[currentIndex]?.label ?? "Preparing"} · ETA ${eta}`}
          </div>
        </div>
        <div className="text-metric text-right">
          <div className="text-2xl font-semibold text-primary">{Math.round(progress)}%</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {framesProcessed.toLocaleString()} / {totalFrames.toLocaleString()} frames
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-background/60">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/70 to-primary"
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear", duration: 0.3 }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-5">
        {STAGES.map((s, i) => {
          const done = i < currentIndex || stage === "done";
          const active = i === currentIndex && stage !== "done";
          return (
            <div
              key={s.key}
              className={`rounded-lg border px-3 py-2 text-xs backdrop-blur transition-colors ${
                done
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : active
                    ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_20px_-6px_var(--color-primary)]"
                    : "border-border/50 bg-background/40 text-muted-foreground"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.16em] opacity-70">Step {i + 1}</div>
              <div className="mt-0.5 font-medium">{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
