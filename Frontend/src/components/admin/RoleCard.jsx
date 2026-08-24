import { ShieldCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
const accent = {
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  primary: "border-primary/40 bg-primary/10 text-primary",
  info: "border-info/40 bg-info/10 text-info",
  warning: "border-warning/40 bg-warning/10 text-warning",
  muted: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
};
export function RoleCard({ name, count, permissions, level, description, color }) {
  return (
    <div className="group rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accent[color]}`}
        >
          <ShieldCheck className="h-4 w-4" />
        </div>
        <span className="rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          {level}
        </span>
      </div>
      <div className="mt-4">
        <div className="text-base font-semibold">{name}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div
        className={`mt-4 grid gap-3 rounded-lg border border-border/60 bg-background/30 p-3 ${permissions != null ? "grid-cols-2" : "grid-cols-1"}`}
      >
        <div>
          <div className="text-metric text-lg font-semibold">{count.toLocaleString()}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Members</div>
        </div>
        {permissions != null && (
          <div>
            <div className="text-metric text-lg font-semibold">{permissions}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Permissions
            </div>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        className="mt-3 h-8 w-full justify-between text-xs text-muted-foreground group-hover:text-foreground"
      >
        Manage role
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
