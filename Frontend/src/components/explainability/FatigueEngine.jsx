import { motion } from "framer-motion";
import { ArrowRight, ArrowDown, Zap } from "lucide-react";
const inputs = [
  { label: "EAR", value: "0.19", tone: "primary" },
  { label: "MAR", value: "0.62", tone: "amber" },
  { label: "Head Pose", value: "Y-14° P22°", tone: "purple" },
  { label: "Temporal", value: "1.8 s", tone: "cyan" },
];
const toneClass = (t) =>
  t === "amber"
    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
    : t === "purple"
      ? "border-purple-500/40 bg-purple-500/10 text-purple-200"
      : t === "cyan"
        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
        : "border-primary/40 bg-primary/10 text-primary";
export function FatigueEngine() {
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-6 flex items-center gap-2">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Fatigue Decision Engine</h2>
          <p className="text-xs text-muted-foreground">
            Weighted fusion of features into fatigue score & risk level.
          </p>
        </div>
      </header>

      <div className="grid items-center gap-6 lg:grid-cols-[1.2fr,auto,1fr,auto,0.9fr]">
        <div className="grid grid-cols-2 gap-3">
          {inputs.map((i, idx) => (
            <motion.div
              key={i.label}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className={`rounded-xl border p-3 ${toneClass(i.tone)}`}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">{i.label}</div>
              <div className="font-mono text-lg font-semibold">{i.value}</div>
            </motion.div>
          ))}
        </div>

        <ArrowRight className="mx-auto hidden h-6 w-6 text-muted-foreground lg:block" />
        <ArrowDown className="mx-auto h-6 w-6 text-muted-foreground lg:hidden" />

        <div className="glass-panel rounded-xl border border-primary/40 p-5 text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Fatigue score
          </div>
          <div className="mt-1 font-mono text-4xl font-bold text-primary">
            78<span className="text-lg text-muted-foreground">/100</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/40">
            <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-primary via-amber-400 to-red-500" />
          </div>
        </div>

        <ArrowRight className="mx-auto hidden h-6 w-6 text-muted-foreground lg:block" />
        <ArrowDown className="mx-auto h-6 w-6 text-muted-foreground lg:hidden" />

        <div className="space-y-3">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-red-200/80">Risk level</div>
            <div className="font-mono text-xl font-semibold text-red-200">HIGH</div>
          </div>
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80">Action</div>
            <div className="font-mono text-sm font-semibold text-amber-100">
              Trigger alert · buzzer + SMS
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
