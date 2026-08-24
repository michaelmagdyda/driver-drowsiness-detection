import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Camera,
  Clock,
  Eye,
  Gauge,
  Timer,
  AlertCircle,
  X,
  Activity,
  Moon,
  Trash2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { formatDuration } from "./mockData";
import { StatusBadge, DriverStateBadge } from "./StatusBadge";
export function SessionDetailPanel({ session, onClose, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  if (!session) {
    return (
      <Card className="glass-panel flex h-full min-h-[400px] flex-col items-center justify-center border-border/50 p-8 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <Eye className="h-6 w-6 text-primary" />
        </div>
        <div className="font-display text-sm font-semibold">No session selected</div>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Select a session from the table to inspect its telemetry, alerts and driver posture
          analysis.
        </p>
      </Card>
    );
  }
  const driverState = session.finalState?.toLowerCase();
  const alertLevel = session.alertLevel?.toLowerCase();
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete?.(session.id);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <motion.div
      key={session.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="glass-panel overflow-hidden border-border/50">
        <div className="flex items-start justify-between border-b border-border/50 p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {session.id.slice(0, 8)}
              </span>
              {driverState && <DriverStateBadge state={driverState} />}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={session.status} />
              {alertLevel && <StatusBadge status={alertLevel} />}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={deleting}
                  title="Delete session"
                  className="h-7 w-7 hover:bg-red-500/10 hover:text-red-400"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes session{" "}
                    <span className="font-mono">{session.id.slice(0, 8)}</span>, its detection
                    events and its recording. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <Info
            icon={Clock}
            label="Started"
            value={format(new Date(session.startedAt), "MMM d, HH:mm:ss")}
          />
          <Info
            icon={Timer}
            label="Duration"
            value={
              session.durationSeconds != null
                ? formatDuration(session.durationSeconds)
                : "In progress"
            }
          />
          <Info icon={Camera} label="Source" value={session.source} mono />
          <Info icon={Activity} label="Detection events" value={String(session.totalEvents)} mono />
        </div>

        <Separator />

        <div className="p-5">
          <SectionLabel>Session metrics</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Metric
              icon={Gauge}
              label="Peak fatigue"
              value={session.maxFatigueScore != null ? `${session.maxFatigueScore}` : "—"}
              suffix={session.maxFatigueScore != null ? "/100" : ""}
              tone={
                session.maxFatigueScore > 70
                  ? "danger"
                  : session.maxFatigueScore > 45
                    ? "warn"
                    : "primary"
              }
            />
            <Metric
              icon={AlertCircle}
              label="Alerts"
              value={`${session.totalAlerts}`}
              tone={
                session.totalAlerts > 5 ? "danger" : session.totalAlerts > 0 ? "warn" : "primary"
              }
            />
          </div>
        </div>

        <Separator />

        <div className="p-5">
          <SectionLabel>Event breakdown</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Yawns" value={session.yawnCount} tone="warn" icon={Eye} />
            <Stat
              label="Eyes closed"
              value={`${session.eyeClosureSeconds.toFixed(1)}s`}
              tone="danger"
              icon={Moon}
            />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}
function Info({ icon: Icon, label, value, mono }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3 text-primary" /> {label}
      </div>
      <div className={`text-xs font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
function Metric({ icon: Icon, label, value, suffix, tone }) {
  const color =
    tone === "danger" ? "text-red-400" : tone === "warn" ? "text-amber-300" : "text-primary";
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`font-mono text-lg font-semibold ${color}`}>
        {value}
        <span className="ml-0.5 text-[10px] text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}
function Stat({ label, value, tone, icon: Icon }) {
  const color = tone === "danger" ? "text-red-400" : "text-amber-300";
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-center">
      <div
        className={`flex items-center justify-center gap-1.5 font-mono text-2xl font-semibold ${color}`}
      >
        {Icon && <Icon className="h-4 w-4" />} {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
