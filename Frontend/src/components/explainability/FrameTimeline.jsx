import { useState } from "react";
import { frames } from "./mockData";
import { Film } from "lucide-react";
export function FrameTimeline() {
  const [sel, setSel] = useState(8);
  const f = frames[sel];
  const tone = (r) =>
    r === "High"
      ? "border-red-500/40 bg-red-500/10 text-red-200"
      : r === "Medium"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-primary/40 bg-primary/10 text-primary";
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-4 flex items-center gap-2">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <Film className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Frame Timeline</h2>
          <p className="text-xs text-muted-foreground">
            Scrub through frames to inspect per-frame explanations.
          </p>
        </div>
      </header>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {frames.map((fr, i) => (
          <button
            key={fr.frame}
            onClick={() => setSel(i)}
            className={`glass-panel flex-shrink-0 rounded-lg border p-2 text-left transition ${sel === i ? "border-primary/60 shadow-[0_0_20px_-6px_var(--color-primary)]" : "border-border/50 hover:border-border"}`}
          >
            <div className="mb-1 h-14 w-24 rounded bg-gradient-to-br from-slate-800 to-slate-950" />
            <div className="font-mono text-[10px] text-muted-foreground">#{fr.frame}</div>
            <div
              className={`mt-0.5 rounded px-1.5 py-0.5 text-center text-[9px] uppercase ${tone(fr.risk)}`}
            >
              {fr.prediction}
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <Cell label="Frame" v={`#${f.frame}`} />
        <Cell label="Timestamp" v={f.ts} />
        <Cell label="Prediction" v={f.prediction} />
        <Cell label="Confidence" v={`${(f.confidence * 100).toFixed(0)}%`} />
        <Cell label="EAR" v={String(f.ear)} />
        <Cell label="MAR" v={String(f.mar)} />
      </div>
    </section>
  );
}
function Cell({ label, v }) {
  return (
    <div className="glass-panel rounded-lg border border-border/50 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold">{v}</div>
    </div>
  );
}
