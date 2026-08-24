import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, RotateCcw, Download, Trash2, AlertTriangle } from "lucide-react";
const ACTIONS = [
  {
    icon: LogOut,
    title: "Sign out everywhere",
    desc: "End all sessions on all devices.",
    label: "Sign out",
    tone: "warn",
  },
  {
    icon: RotateCcw,
    title: "Reset preferences",
    desc: "Restore appearance and defaults.",
    label: "Reset",
    tone: "warn",
  },
  {
    icon: Download,
    title: "Export personal data",
    desc: "Download all your data as JSON.",
    label: "Export",
    tone: "info",
  },
  {
    icon: Trash2,
    title: "Delete account",
    desc: "Permanent · requires admin approval.",
    label: "Request",
    tone: "danger",
  },
];
const TONE = {
  warn: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  info: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  danger: "text-rose-300 border-rose-400/40 bg-rose-400/10",
};
export function DangerZone() {
  return (
    <Card className="border-rose-400/30 bg-rose-400/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-rose-300" />
        <div className="font-display text-base font-semibold text-rose-200">Danger zone</div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {ACTIONS.map((a) => (
          <div
            key={a.title}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 p-3"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl border ${TONE[a.tone]}`}
              >
                <a.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-[11px] text-muted-foreground">{a.desc}</div>
              </div>
            </div>
            <Button size="sm" variant={a.tone === "danger" ? "destructive" : "outline"}>
              {a.label}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
