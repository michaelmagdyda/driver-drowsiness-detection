import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SeverityBadge, SeverityDot, StatusPill } from "./SeverityBadge";
import { formatTime } from "./mockData";
import { cn } from "@/lib/utils";
export function AlertFeed({ alerts, selectedId, onSelect }) {
  return (
    <Card className="glass-panel border-border/50">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <div className="font-display text-sm font-semibold">Live Alert Feed</div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            · streaming
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Radio className="h-3 w-3" /> {alerts.length} events
        </div>
      </div>

      <div className="max-h-[720px] overflow-y-auto p-3">
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const active = a.id === selectedId;
            return (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                onClick={() => onSelect(a)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                  active
                    ? "border-primary/50 bg-primary/[0.06] shadow-[inset_0_0_20px_-6px_var(--color-primary)]"
                    : "border-border/40 bg-background/40 hover:border-primary/40 hover:bg-primary/[0.03]",
                )}
              >
                <SeverityDot severity={a.severity} />
                <Avatar className="h-9 w-9 border border-border/60">
                  <AvatarFallback className="bg-muted/40 text-[11px]">
                    {a.driverInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">{a.type}</span>
                    <SeverityBadge severity={a.severity} withIcon={false} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>{formatTime(a.timestamp)}</span>·
                    <span className="truncate">{a.driverName}</span>·<span>{a.sessionId}</span>
                  </div>
                </div>
                <div className="hidden flex-col items-end gap-1 md:flex">
                  <StatusPill status={a.status} />
                  <div className="font-mono text-[10px] text-muted-foreground">
                    conf {a.confidence}% · fat {a.fatigue}
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
