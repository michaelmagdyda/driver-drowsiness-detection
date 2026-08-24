import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, Trash2, Archive, Sparkles } from "lucide-react";
import { STORAGE } from "./data";
export function StoragePanel() {
  const usedPct = Math.round((STORAGE.usedGB / STORAGE.totalGB) * 100);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="glass-panel border-border/50 p-5 lg:col-span-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <div className="font-display text-base font-semibold">Workspace storage</div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {STORAGE.usedGB.toFixed(1)} GB of {STORAGE.totalGB} GB used
              </div>
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-semibold text-primary">{usedPct}%</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              utilization
            </div>
          </div>
        </div>

        <div className="mt-4 flex h-3 overflow-hidden rounded-full border border-border/60 bg-background/40">
          {STORAGE.breakdown.map((b) => (
            <div
              key={b.label}
              style={{ width: `${(b.value / STORAGE.totalGB) * 100}%`, background: b.color }}
              title={`${b.label} · ${b.value} GB`}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
          {STORAGE.breakdown.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 p-2.5"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-muted-foreground">{b.label}</div>
                <div className="font-mono text-sm font-semibold">{b.value} GB</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="glass-panel border-border/50 p-5">
        <div className="font-display text-sm font-semibold">Maintenance</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Reclaim space by clearing derived data. Original session recordings are preserved.
        </p>
        <div className="mt-4 space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Clear cache
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2">
            <Trash2 className="h-4 w-4 text-amber-300" /> Delete temporary files
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2">
            <Archive className="h-4 w-4 text-sky-300" /> Archive old sessions
          </Button>
        </div>
      </Card>
    </div>
  );
}
