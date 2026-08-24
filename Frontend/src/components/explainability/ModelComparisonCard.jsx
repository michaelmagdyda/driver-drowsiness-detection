import { modelComparison } from "./mockData";
import { Cpu, CheckCircle2 } from "lucide-react";
export function ModelComparisonCard() {
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-5 flex items-center gap-2">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <Cpu className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Model Comparison</h2>
          <p className="text-xs text-muted-foreground">
            Benchmark of candidate detectors against the active model.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {modelComparison.map((m) => (
          <div
            key={m.name}
            className={`glass-panel rounded-xl border p-4 ${m.active ? "border-primary/60 shadow-[0_0_30px_-10px_var(--color-primary)]" : "border-border/50"}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-display text-base font-semibold">{m.name}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {m.status}
                </div>
              </div>
              {m.active && (
                <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase text-primary">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Row k="Precision" v={m.precision.toFixed(3)} />
              <Row k="Recall" v={m.recall.toFixed(3)} />
              <Row k="F1" v={m.f1.toFixed(3)} />
              <Row k="mAP" v={m.map.toFixed(3)} />
              <Row k="Speed" v={m.speed} />
              <Row k="Size" v={m.size} />
              <Row k="GPU" v={m.memory} />
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/40 bg-card/50 px-2 py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono font-semibold">{v}</span>
    </div>
  );
}
