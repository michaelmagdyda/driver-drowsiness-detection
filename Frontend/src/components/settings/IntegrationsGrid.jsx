import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, CheckCircle2, XCircle, Loader2, Settings2 } from "lucide-react";
import { INTEGRATIONS } from "./data";
import { cn } from "@/lib/utils";
const STATUS = {
  connected: {
    icon: CheckCircle2,
    className: "border-primary/40 bg-primary/10 text-primary",
    label: "Connected",
  },
  disconnected: {
    icon: XCircle,
    className: "border-muted/60 bg-muted/20 text-muted-foreground",
    label: "Disconnected",
  },
  pending: {
    icon: Loader2,
    className: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    label: "Pending",
    spin: true,
  },
};
export function IntegrationsGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {INTEGRATIONS.map((i) => {
        const s = STATUS[i.status];
        const SIcon = s.icon;
        return (
          <Card
            key={i.id}
            className="glass-panel flex flex-col justify-between border-border/50 p-4"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <Plug className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                    s.className,
                  )}
                >
                  <SIcon className={cn("h-3 w-3", "spin" in s && s.spin && "animate-spin")} />{" "}
                  {s.label}
                </span>
              </div>
              <div className="mt-3 font-display text-base font-semibold">{i.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{i.desc}</div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Last sync · {i.sync}
              </div>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[11px]">
                <Settings2 className="h-3 w-3" /> Configure
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
