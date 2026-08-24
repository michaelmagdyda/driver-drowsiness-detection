import { modelMetrics } from "./mockData";
import { Cpu, Gauge as GaugeIcon } from "lucide-react";
function Metric({ label, value, tone = "primary" }) {
  const color =
    tone === "amber" ? "text-amber-300" : tone === "red" ? "text-red-300" : "text-primary";
  return (
    <div className="glass-panel rounded-xl border border-border/50 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
function Bar({ label, pct, color }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
    </div>
  );
}
export function ModelPerformance() {
  const m = modelMetrics;
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-5 flex items-center gap-2">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <GaugeIcon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Model Performance</h2>
          <p className="text-xs text-muted-foreground">
            Live AI metrics · {m.version} · {m.modelSize}
          </p>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Precision" value={m.precision.toFixed(3)} />
        <Metric label="Recall" value={m.recall.toFixed(3)} />
        <Metric label="F1" value={m.f1.toFixed(3)} />
        <Metric label="mAP@0.5" value={m.map50.toFixed(3)} />
        <Metric label="mAP@0.5:0.95" value={m.map5095.toFixed(3)} />
        <Metric label="FPS" value={String(m.fps)} tone="amber" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="glass-panel rounded-xl border border-border/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" /> Hardware
          </div>
          <div className="space-y-3">
            <Bar label="GPU" pct={m.gpu} color="var(--color-primary)" />
            <Bar label="CPU" pct={m.cpu} color="var(--color-signal-drowsy)" />
            <Bar label="RAM" pct={m.ram} color="var(--color-chart-2)" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Latency" value={`${m.latency} ms`} />
          <Metric label="Inference" value={`${m.latency} ms`} />
          <Metric label="Model size" value={m.modelSize} />
          <Metric label="Version" value={m.version} />
        </div>
      </div>
    </section>
  );
}
