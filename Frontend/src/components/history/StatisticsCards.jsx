import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import {
  Layers,
  AlertTriangle,
  ShieldCheck,
  Moon,
  Eye,
  Gauge,
  Activity,
  Clock,
} from "lucide-react";
import { formatDuration } from "./mockData";
export function StatisticsCards({ sessions }) {
  const total = sessions.length;
  const alerts = sessions.reduce((a, s) => a + s.totalAlerts, 0);
  const safe = sessions.filter((s) => s.alertLevel === "SAFE").length;
  const drowsy = sessions.filter((s) => s.finalState === "DROWSY").length;
  const sleeping = sessions.filter((s) => s.finalState === "SLEEPING").length;
  const scored = sessions.filter((s) => s.maxFatigueScore != null);
  const avgFat = Math.round(
    scored.reduce((a, s) => a + s.maxFatigueScore, 0) / (scored.length || 1),
  );
  const totalEvents = sessions.reduce((a, s) => a + s.totalEvents, 0);
  const totalTime = sessions.reduce((a, s) => a + (s.durationSeconds ?? 0), 0);
  const items = [
    { label: "Total Sessions", value: total.toString(), icon: Layers, tone: "text-primary" },
    {
      label: "Total Alerts",
      value: alerts.toString(),
      icon: AlertTriangle,
      tone: "text-amber-300",
    },
    { label: "Safe Sessions", value: safe.toString(), icon: ShieldCheck, tone: "text-primary" },
    { label: "Drowsy Sessions", value: drowsy.toString(), icon: Eye, tone: "text-amber-300" },
    { label: "Sleeping Sessions", value: sleeping.toString(), icon: Moon, tone: "text-red-400" },
    { label: "Avg Fatigue", value: `${avgFat}%`, icon: Gauge, tone: "text-primary" },
    {
      label: "Detection Events",
      value: totalEvents.toString(),
      icon: Activity,
      tone: "text-primary",
    },
    {
      label: "Monitoring Time",
      value: formatDuration(totalTime),
      icon: Clock,
      tone: "text-primary",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.4 }}
          >
            <Card className="glass-panel group relative overflow-hidden border-border/50 p-4 transition-all hover:border-primary/40">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {it.label}
                </span>
                <Icon className={`h-3.5 w-3.5 ${it.tone}`} />
              </div>
              <div className="font-mono text-2xl font-semibold text-foreground">{it.value}</div>
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
