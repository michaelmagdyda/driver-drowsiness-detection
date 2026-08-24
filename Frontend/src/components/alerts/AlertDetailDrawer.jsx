import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, CheckCircle2, Flag, Eye, Download, Share2, PhoneCall, ImageIcon } from "lucide-react";
import { SeverityBadge, StatusPill } from "./SeverityBadge";
import { NotificationStatusCard } from "./NotificationStatusCard";
import { Timeline } from "./Timeline";
import { formatDateTime, TIMELINE_MOCK } from "./mockData";
export function AlertDetailDrawer({ alert, onClose }) {
  if (!alert) {
    return (
      <Card className="glass-panel flex h-full min-h-[400px] flex-col items-center justify-center border-border/50 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/20 text-muted-foreground">
          <Eye className="h-5 w-5" />
        </div>
        <div className="mt-3 font-display text-sm font-semibold">No alert selected</div>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Pick an event from the live feed to inspect telemetry, delivery status, and the AI
          decision trail.
        </p>
      </Card>
    );
  }
  return (
    <Card className="glass-panel border-border/50">
      <div className="flex items-start justify-between border-b border-border/50 p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 border border-primary/30">
            <AvatarFallback className="bg-primary/10 text-primary">
              {alert.driverInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold">{alert.type}</span>
              <SeverityBadge severity={alert.severity} />
            </div>
            <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{alert.id}</span>·<span>{formatDateTime(alert.timestamp)}</span>·
              <StatusPill status={alert.status} />
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-5 p-5">
        {/* Screenshot placeholder */}
        <div className="relative aspect-video overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background to-muted/20">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
              <span className="font-mono text-[10px] uppercase tracking-widest">
                Frame capture · placeholder
              </span>
            </div>
          </div>
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> REC · session {alert.sessionId}
          </div>
        </div>

        {/* Driver & Session */}
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Driver" value={alert.driverName} />
          <InfoRow label="Session" value={alert.sessionId} />
          <InfoRow label="Confidence" value={`${alert.confidence}%`} />
          <InfoRow label="Fatigue Score" value={`${alert.fatigue}/100`} />
        </div>

        {/* AI Detection Summary */}
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            AI Detection Summary
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="EAR" value={alert.ear.toFixed(3)} />
            <Metric label="MAR" value={alert.mar.toFixed(3)} />
            <Metric label="Head Pose" value={alert.headPose} />
          </div>
        </div>

        {/* AI Explanation */}
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.04] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
            Trigger Reason
          </div>
          <p className="mt-1 text-sm text-foreground">{alert.triggerReason}</p>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Suggested Action
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{alert.suggestedAction}</p>
        </div>

        {/* Delivery */}
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Notification Delivery
          </div>
          <div className="space-y-2">
            {alert.deliveries.map((d) => (
              <NotificationStatusCard key={d.channel} delivery={d} />
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Event Timeline
          </div>
          <Timeline events={TIMELINE_MOCK} />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Button size="sm" className="justify-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
          </Button>
          <Button size="sm" variant="secondary" className="justify-start gap-2">
            <Flag className="h-3.5 w-3.5" /> Resolve
          </Button>
          <Button size="sm" variant="outline" className="justify-start gap-2">
            <Eye className="h-3.5 w-3.5" /> View Session
          </Button>
          <Button size="sm" variant="outline" className="justify-start gap-2">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button size="sm" variant="outline" className="justify-start gap-2">
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="justify-start gap-2 text-muted-foreground"
            disabled
          >
            <PhoneCall className="h-3.5 w-3.5" /> Contact
          </Button>
        </div>
      </div>
    </Card>
  );
}
function InfoRow({ label, value }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}
function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
