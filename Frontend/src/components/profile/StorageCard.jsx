import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, Trash2, Archive } from "lucide-react";
import { storageBreakdown } from "./mockData";
const TOTAL = 500;
export function StorageCard() {
  const used = storageBreakdown.reduce((sum, s) => sum + s.value, 0);
  const pct = Math.round((used / TOTAL) * 100);
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <HardDrive className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-base font-semibold">Storage overview</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {used} GB of {TOTAL} GB used
            </div>
          </div>
        </div>
        <div className="text-right font-mono">
          <div className="text-2xl font-semibold text-primary">{pct}%</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            utilization
          </div>
        </div>
      </div>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full border border-border/60 bg-background/40">
        {storageBreakdown.map((b) => (
          <div
            key={b.label}
            style={{ width: `${(b.value / TOTAL) * 100}%`, background: b.color }}
            title={`${b.label} · ${b.value} GB`}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {storageBreakdown.map((b) => {
          const bpct = Math.round((b.value / TOTAL) * 100);
          return (
            <div key={b.label} className="rounded-lg border border-border/50 bg-background/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                  <span className="text-xs text-muted-foreground">{b.label}</span>
                </div>
                <span className="font-mono text-xs">{b.value} GB</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/30">
                <div className="h-full" style={{ width: `${bpct}%`, background: b.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-4">
        <Button variant="outline" size="sm" className="gap-2">
          <Trash2 className="h-3.5 w-3.5 text-amber-300" /> Clean storage
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <Archive className="h-3.5 w-3.5 text-sky-300" /> Download archive
        </Button>
      </div>
    </Card>
  );
}
