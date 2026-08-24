import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, CheckCircle2, XCircle, Settings2 } from "lucide-react";
import { connectedServices } from "./mockData";
import { cn } from "@/lib/utils";
export function ConnectionCard() {
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-display text-base font-semibold">Connected services</div>
          <div className="text-xs text-muted-foreground">
            Integrations that power your workspace.
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {connectedServices.filter((s) => s.status === "connected").length} of{" "}
          {connectedServices.length} live
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {connectedServices.map((s) => {
          const connected = s.status === "connected";
          const StatusIcon = connected ? CheckCircle2 : XCircle;
          return (
            <div
              key={s.name}
              className="flex flex-col justify-between rounded-xl border border-border/50 bg-background/40 p-4"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <Plug className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                      connected
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "border-muted/60 bg-muted/20 text-muted-foreground",
                    )}
                  >
                    <StatusIcon className="h-3 w-3" /> {connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="mt-3 font-display text-sm font-semibold">{s.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.desc}</div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Sync · {s.sync}
                </div>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[11px]">
                  <Settings2 className="h-3 w-3" /> Configure
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
