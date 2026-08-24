import { motion } from "framer-motion";
import { Play, Square, FileText, Eye, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
const statusStyles = {
  focused: { text: "text-primary", ring: "ring-primary/30", dot: "bg-primary", label: "Focused" },
  warning: { text: "text-warning", ring: "ring-warning/30", dot: "bg-warning", label: "Warning" },
  critical: {
    text: "text-destructive",
    ring: "ring-destructive/40",
    dot: "bg-destructive",
    label: "Critical",
  },
};
export function SessionCard({ id, driver, camera, elapsed, status, fatigue, confidence, alerts }) {
  const s = statusStyles[status] ?? statusStyles.focused;
  return (
    <div
      className={`group rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl ring-1 ${s.ring}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <Radio className="h-4 w-4 text-primary" />
            <motion.span
              className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ${s.dot}`}
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          </div>
          <div>
            <div className="text-sm font-medium">{driver}</div>
            <div className="text-[11px] text-muted-foreground">{camera}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-metric text-sm font-semibold">{elapsed}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Elapsed</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Fatigue" value={`${fatigue}%`} tone={s.text} />
        <Stat label="Confidence" value={`${confidence}%`} />
        <Stat label="Alerts" value={String(alerts)} tone={alerts > 0 ? "text-warning" : ""} />
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted/40">
        <motion.div
          className={`h-full ${status === "critical" ? "bg-destructive" : status === "warning" ? "bg-warning" : "bg-primary"}`}
          initial={{ width: 0 }}
          animate={{ width: `${fatigue}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">#{id}</span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
            <Square className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
function Stat({ label, value, tone = "" }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-2 text-center">
      <div className={`text-metric text-sm font-semibold ${tone}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
