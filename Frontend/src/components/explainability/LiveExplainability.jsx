import { motion } from "framer-motion";
import {
  ArrowRight,
  ScanFace,
  Eye,
  MessageSquare,
  Compass,
  Boxes,
  CheckCircle2,
} from "lucide-react";
const chain = [
  { icon: ScanFace, label: "Face detected", detail: "conf 0.98" },
  { icon: Eye, label: "Eyes localised", detail: "L/R landmarks" },
  { icon: MessageSquare, label: "Mouth localised", detail: "68-pt mesh" },
  { icon: Compass, label: "Head pose", detail: "PnP solver" },
  { icon: Boxes, label: "Detector boxes", detail: "3 classes" },
  { icon: CheckCircle2, label: "Decision", detail: "Drowsy · 91.2%" },
];
export function LiveExplainability() {
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Live Explainability</h2>
          <p className="text-xs text-muted-foreground">
            Visual breakdown of what the model sees for the current frame.
          </p>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
          frame · 218
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.2fr,1fr]">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-border/50 bg-[radial-gradient(80%_60%_at_50%_40%,oklch(0.22_0.02_240),oklch(0.14_0.02_240))]">
          <div className="absolute inset-0 grid-bg opacity-40" />
          {/* Face box */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="absolute left-[32%] top-[18%] h-[62%] w-[36%] rounded-md border-2 border-primary/70 shadow-[0_0_30px_-6px_var(--color-primary)]"
          >
            <span className="absolute -top-5 left-0 font-mono text-[10px] uppercase tracking-widest text-primary">
              face · 0.98
            </span>
          </motion.div>
          {/* Eyes */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="absolute left-[38%] top-[36%] h-[8%] w-[10%] rounded border border-cyan-300/80"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute left-[52%] top-[36%] h-[8%] w-[10%] rounded border border-cyan-300/80"
          />
          {/* Mouth */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="absolute left-[42%] top-[58%] h-[9%] w-[18%] rounded border border-amber-300/80"
          />
          {/* Head pose axes */}
          <svg
            className="absolute left-[46%] top-[42%] h-24 w-24 -translate-x-1/2 -translate-y-1/2"
            viewBox="0 0 100 100"
          >
            <line x1="50" y1="50" x2="86" y2="50" stroke="oklch(0.78 0.16 25)" strokeWidth="2" />
            <line x1="50" y1="50" x2="50" y2="18" stroke="oklch(0.82 0.16 140)" strokeWidth="2" />
            <line x1="50" y1="50" x2="30" y2="66" stroke="oklch(0.78 0.16 240)" strokeWidth="2" />
          </svg>
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-border/50 bg-card/70 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> live · 30 fps
          </div>
        </div>

        <ol className="space-y-2.5">
          {chain.map((s, i) => (
            <motion.li
              key={s.label}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="glass-panel flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2.5"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{s.label}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{s.detail}</div>
              </div>
              {i < chain.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
