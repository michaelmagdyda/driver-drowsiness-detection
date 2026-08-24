import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
} from "recharts";
import { featureImportance } from "./mockData";
import { Layers } from "lucide-react";
export function FeatureImportanceChart() {
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-5 flex items-center gap-2">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Feature Importance</h2>
          <p className="text-xs text-muted-foreground">
            Contribution of each signal to the current decision.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          {featureImportance.map((f) => (
            <div key={f.name}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">{f.name}</span>
                <span className="font-mono font-semibold" style={{ color: f.color }}>
                  {f.value}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${f.value}%`,
                    background: f.color,
                    boxShadow: `0 0 12px ${f.color}`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={featureImportance}
                dataKey="value"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={3}
              >
                {featureImportance.map((f, i) => (
                  <Cell key={i} fill={f.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--color-foreground)",
                }}
                itemStyle={{ color: "var(--color-foreground)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={featureImportance}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis
                dataKey="name"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
              />
              <Radar
                dataKey="value"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.35}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
