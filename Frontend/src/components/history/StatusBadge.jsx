import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Activity,
  XCircle,
  Loader2,
  Radio,
} from "lucide-react";
// Real alert-level severity (backend's SAFE/WARNING/DANGER/EMERGENCY, lowercased)...
const STATUS = {
  safe: {
    label: "Safe",
    className: "border-primary/40 bg-primary/10 text-primary",
    icon: CheckCircle2,
  },
  warning: {
    label: "Warning",
    className: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    icon: AlertTriangle,
  },
  danger: {
    label: "Danger",
    className: "border-red-500/40 bg-red-500/10 text-red-400",
    icon: ShieldAlert,
  },
  emergency: {
    label: "Emergency",
    className: "border-red-600/50 bg-red-600/15 text-red-400",
    icon: ShieldAlert,
  },
  // ...plus the session's real lifecycle status (active/processing/completed/failed).
  active: {
    label: "Active",
    className: "border-sky-400/40 bg-sky-400/10 text-sky-300",
    icon: Radio,
  },
  processing: {
    label: "Processing",
    className: "border-sky-400/40 bg-sky-400/10 text-sky-300",
    icon: Loader2,
  },
  completed: {
    label: "Completed",
    className: "border-primary/30 bg-primary/5 text-primary/90",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "border-muted/40 bg-muted/10 text-muted-foreground",
    icon: XCircle,
  },
  interrupted: {
    label: "Interrupted",
    className: "border-muted/40 bg-muted/10 text-muted-foreground",
    icon: XCircle,
  },
};
const DRIVER = {
  awake: { label: "Awake", className: "border-primary/40 bg-primary/10 text-primary" },
  alert: { label: "Alert", className: "border-primary/40 bg-primary/10 text-primary" },
  yawning: { label: "Yawning", className: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  drowsy: { label: "Drowsy", className: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  sleeping: { label: "Sleeping", className: "border-red-500/40 bg-red-500/10 text-red-400" },
  unknown: {
    label: "Unknown",
    className: "border-muted/40 bg-muted/10 text-muted-foreground",
  },
};
const SEV = {
  low: "border-primary/40 bg-primary/10 text-primary",
  medium: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  high: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  critical: "border-red-500/40 bg-red-500/10 text-red-400",
};
export function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.interrupted;
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        s.className,
      )}
    >
      <Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}
export function DriverStateBadge({ state }) {
  const s = DRIVER[state] ?? DRIVER.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider",
        s.className,
      )}
    >
      <Activity className="h-3 w-3" /> {s.label}
    </span>
  );
}
export function SeverityBadge({ severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest",
        SEV[severity],
      )}
    >
      {severity}
    </span>
  );
}
