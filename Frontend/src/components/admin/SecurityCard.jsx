import { Shield, TrendingUp } from "lucide-react";
const tones = {
  info: "border-info/40 bg-info/10 text-info",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
};
export function SecurityCard({ label, value, trend, severity }) {
  const t = tones[severity] ?? tones.info;
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${t}`}>
          <Shield className="h-4 w-4" />
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          {trend}
        </span>
      </div>
      <div className="mt-4">
        <div className="text-metric text-2xl font-semibold">{value}</div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
