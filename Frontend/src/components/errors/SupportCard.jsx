import { BookOpen, HelpCircle, LifeBuoy, Activity, Flag } from "lucide-react";
const links = [
  { icon: BookOpen, label: "Documentation" },
  { icon: HelpCircle, label: "FAQ" },
  { icon: LifeBuoy, label: "Contact support" },
  { icon: Activity, label: "System status" },
  { icon: Flag, label: "Report issue" },
];
export function SupportCard() {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Need a hand?
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {links.map((l) => (
          <button
            key={l.label}
            type="button"
            className="group flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-left text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
          >
            <l.icon className="h-3.5 w-3.5 transition-colors group-hover:text-primary" />
            <span className="truncate">{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
