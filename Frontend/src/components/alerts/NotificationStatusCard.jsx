import {
  Mail,
  MessageCircle,
  Volume2,
  Bell,
  Smartphone,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
const CHANNEL_ICON = {
  Email: Mail,
  WhatsApp: MessageCircle,
  "Sound Alarm": Volume2,
  Browser: Bell,
  SMS: Smartphone,
};
const STATUS_STYLE = {
  sent: {
    icon: CheckCircle2,
    className: "border-primary/40 bg-primary/10 text-primary",
    label: "Sent",
  },
  pending: {
    icon: Loader2,
    className: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    label: "Pending",
  },
  failed: {
    icon: XCircle,
    className: "border-red-500/40 bg-red-500/10 text-red-400",
    label: "Failed",
  },
  queued: {
    icon: Clock,
    className: "border-muted/60 bg-muted/20 text-muted-foreground",
    label: "Queued",
  },
};
export function NotificationStatusCard({ delivery }) {
  const Icon = CHANNEL_ICON[delivery.channel];
  const s = STATUS_STYLE[delivery.status];
  const SIcon = s.icon;
  const spinning = delivery.status === "pending";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-muted/20">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium">{delivery.channel}</div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {delivery.time} · retries {delivery.retries}
          {delivery.error && <span className="ml-1 text-red-400">· {delivery.error}</span>}
        </div>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
          s.className,
        )}
      >
        <SIcon className={cn("h-3 w-3", spinning && "animate-spin")} /> {s.label}
      </span>
    </div>
  );
}
