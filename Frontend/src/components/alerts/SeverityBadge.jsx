import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, ShieldAlert, Siren, Info } from "lucide-react";
const SEV = {
  safe: {
    label: "Safe",
    className: "border-primary/40 bg-primary/10 text-primary",
    icon: CheckCircle2,
    dot: "bg-primary",
  },
  low: {
    label: "Low",
    className: "border-primary/40 bg-primary/10 text-primary",
    icon: Info,
    dot: "bg-primary",
  },
  medium: {
    label: "Medium",
    className: "border-sky-400/40 bg-sky-400/10 text-sky-300",
    icon: Info,
    dot: "bg-sky-400",
  },
  high: {
    label: "High",
    className: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    icon: AlertTriangle,
    dot: "bg-amber-400",
  },
  critical: {
    label: "Critical",
    className: "border-red-500/50 bg-red-500/10 text-red-400",
    icon: Siren,
    dot: "bg-red-500",
  },
};
const STATUS = {
  new: "border-red-500/40 bg-red-500/10 text-red-400",
  acknowledged: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  escalated: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  resolved: "border-primary/40 bg-primary/10 text-primary",
};
export function SeverityBadge({ severity, withIcon = true }) {
  const s = SEV[severity];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest",
        s.className,
      )}
    >
      {withIcon && <Icon className="h-3 w-3" />} {s.label}
    </span>
  );
}
export function SeverityDot({ severity }) {
  const s = SEV[severity];
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]", s.dot)}
    />
  );
}
export function StatusPill({ status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        STATUS[status],
      )}
    >
      <ShieldAlert className="h-3 w-3" /> {status}
    </span>
  );
}
