import { recommendations } from "./mockData";
import { Lightbulb, AlertTriangle, Info } from "lucide-react";
const map = {
  high: { icon: AlertTriangle, tone: "border-red-500/40 bg-red-500/10 text-red-200" },
  medium: { icon: Lightbulb, tone: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
  low: { icon: Info, tone: "border-primary/40 bg-primary/10 text-primary" },
};
export function RecommendationCard() {
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-5 flex items-center gap-2">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">AI Recommendations</h2>
          <p className="text-xs text-muted-foreground">
            Actionable insights generated from this session's telemetry.
          </p>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {recommendations.map((r, i) => {
          const cfg = map[r.severity];
          const Icon = cfg.icon;
          return (
            <div key={i} className={`glass-panel rounded-xl border p-4 ${cfg.tone}`}>
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-current/30 bg-background/20 p-2">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{r.title}</div>
                  <div className="mt-1 text-xs opacity-80">{r.detail}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
