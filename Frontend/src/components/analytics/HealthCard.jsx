import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Server, Database, HardDrive, Zap, Wifi, Camera, Layers, Activity } from "lucide-react";
const ICONS = { Server, Database, HardDrive, Zap, Wifi, Camera, Layers, Activity };
export function HealthCard({ item, delay = 0 }) {
  const Icon = ICONS[item.icon] ?? Activity;
  const dot =
    item.status === "ok"
      ? "bg-primary shadow-[0_0_10px_var(--color-primary)]"
      : item.status === "warn"
        ? "bg-amber-300 shadow-[0_0_10px_var(--color-signal-drowsy)]"
        : "bg-red-400 shadow-[0_0_10px_var(--color-signal-danger)]";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="glass-panel border-border/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              {item.label}
            </span>
          </div>
          <span className={`h-2 w-2 rounded-full ${dot}`} />
        </div>
        <div className="font-mono text-lg font-semibold text-foreground">{item.value}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{item.meta}</div>
      </Card>
    </motion.div>
  );
}
