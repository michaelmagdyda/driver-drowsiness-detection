import { Card } from "@/components/ui/card";
import { Mail, MessageCircle, Volume2, Gauge, Eye, Smile, ChevronRight } from "lucide-react";
const ITEMS = [
  { icon: Mail, label: "Email Notifications", desc: "Recipients, digest cadence, templates" },
  {
    icon: MessageCircle,
    label: "WhatsApp Notifications",
    desc: "Provider, opt-in list, throttling",
  },
  { icon: Volume2, label: "Alarm Sound", desc: "Volume, escalation ramp, test tone" },
  { icon: Gauge, label: "Fatigue Threshold", desc: "Warning / danger cut-offs" },
  { icon: Eye, label: "EAR Threshold", desc: "Eye aspect ratio floor" },
  { icon: Smile, label: "MAR Threshold", desc: "Mouth aspect ratio ceiling" },
];
export function SettingsShortcut() {
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-display text-sm font-semibold">Notification Settings</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Shortcuts
          </div>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {ITEMS.map((i) => (
          <button
            key={i.label}
            className="group flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.04]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <i.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">{i.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{i.desc}</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>
    </Card>
  );
}
