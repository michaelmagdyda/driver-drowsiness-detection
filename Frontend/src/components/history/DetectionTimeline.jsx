import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Play, AlertTriangle, Eye, Moon, Smile, CheckCircle2, Flag } from "lucide-react";
const ICON = {
  start: Play,
  yawn: Smile,
  "eyes-closed": Eye,
  warning: AlertTriangle,
  sleep: Moon,
  recovered: CheckCircle2,
  end: Flag,
};
const COLOR = {
  info: "border-primary/40 bg-primary/10 text-primary",
  low: "border-primary/40 bg-primary/10 text-primary",
  medium: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  high: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  critical: "border-red-500/40 bg-red-500/10 text-red-400",
};
export function DetectionTimeline({ events }) {
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-display text-sm font-semibold">Detection Timeline</div>
          <div className="text-[11px] text-muted-foreground">
            Click an event to jump to the corresponding frame
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {events.length} events
        </span>
      </div>

      <div className="relative pl-5">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-gradient-to-b from-primary/40 via-border/60 to-transparent" />
        <div className="space-y-3">
          {events.map((e, i) => {
            const Icon = ICON[e.type];
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative flex w-full items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.04]"
              >
                <div
                  className={`absolute -left-[19px] flex h-4 w-4 items-center justify-center rounded-full border-2 ${COLOR[e.severity]}`}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-current" />
                </div>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border ${COLOR[e.severity]}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium">{e.label}</div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {e.t} · {e.severity}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
