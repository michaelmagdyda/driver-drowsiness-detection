import {
  UserPlus,
  Upload,
  Database,
  FileText,
  RefreshCw,
  Terminal,
  Download,
  Zap,
} from "lucide-react";
const actions = [
  { label: "Add User", icon: UserPlus },
  { label: "Upload AI Model", icon: Upload },
  { label: "Backup Database", icon: Database },
  { label: "Generate System Report", icon: FileText },
  { label: "Restart AI Service", icon: RefreshCw },
  { label: "View Logs", icon: Terminal },
  { label: "Export Audit Logs", icon: Download },
  { label: "Run Diagnostics", icon: Zap },
];
export function QuickActionPanel() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Quick Actions</div>
          <div className="text-xs text-muted-foreground">Administrator shortcuts</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {actions.map((a) => (
          <button
            key={a.label}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-background/40 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <a.icon className="h-4 w-4" />
            </div>
            <div className="text-xs font-medium">{a.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
