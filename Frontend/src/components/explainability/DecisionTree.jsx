import { Check, X, GitBranch } from "lucide-react";
const nodes = [
  { q: "EAR < 0.22 ?", a: "YES", val: "0.19", tone: "yes" },
  { q: "Closure duration > 1.2s ?", a: "YES", val: "1.8s", tone: "yes" },
  { q: "MAR > 0.55 ?", a: "YES", val: "0.62", tone: "yes" },
  { q: "Fatigue score > 70 ?", a: "YES", val: "78", tone: "yes" },
  { q: "Trigger Alert", a: "ACTION", val: "Red · Buzzer", tone: "action" },
];
export function DecisionTree() {
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-5 flex items-center gap-2">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <GitBranch className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Decision Tree</h2>
          <p className="text-xs text-muted-foreground">
            Rule-based path that led to the final alert.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-5">
        {nodes.map((n, i) => (
          <div key={i} className="relative">
            <div
              className={`glass-panel h-full rounded-xl border p-4 ${n.tone === "action" ? "border-red-500/40 bg-red-500/10" : "border-primary/30 bg-primary/5"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Node {i + 1}
                </span>
                {n.tone === "yes" ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : n.tone === "no" ? (
                  <X className="h-4 w-4 text-red-400" />
                ) : null}
              </div>
              <div className="mt-2 text-sm font-semibold">{n.q}</div>
              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase ${n.tone === "action" ? "bg-red-500/20 text-red-200" : "bg-primary/20 text-primary"}`}
                >
                  {n.a}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{n.val}</span>
              </div>
            </div>
            {i < nodes.length - 1 && (
              <div className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 md:block">
                <div className="h-px w-4 bg-gradient-to-r from-primary/60 to-transparent" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
