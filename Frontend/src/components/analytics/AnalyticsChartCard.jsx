import { Card } from "@/components/ui/card";
export function AnalyticsChartCard({ title, subtitle, actions, children, className = "" }) {
  return (
    <Card className={`glass-panel border-border/50 p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}
export const AXIS = { stroke: "var(--color-muted-foreground)", fontSize: 10 };
export const GRID = "var(--color-border)";
export const TT = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 11,
    fontFamily: "JetBrains Mono, monospace",
    color: "var(--color-foreground)",
  },
};
