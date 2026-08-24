import { storageBreakdown } from "./mockData";
import { HardDrive, Archive, Database, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function StoragePanel() {
  const total = storageBreakdown.reduce((s, x) => s + x.used, 0);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Storage Distribution</div>
            <div className="text-xs text-muted-foreground">
              Aggregate usage across buckets and volumes
            </div>
          </div>
          <div className="text-right">
            <div className="text-metric text-2xl font-semibold">
              {total} <span className="text-sm text-muted-foreground">GB</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Used of 2 TB
            </div>
          </div>
        </div>

        <div className="mt-5 flex h-3 overflow-hidden rounded-full border border-border/60 bg-background/40">
          {storageBreakdown.map((s) => (
            <div
              key={s.label}
              style={{ width: `${(s.used / total) * 100}%`, background: s.color }}
              className="transition-all hover:brightness-125"
            />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3">
          {storageBreakdown.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
            >
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                style={{ background: s.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs">{s.label}</div>
                <div className="text-metric text-[11px] text-muted-foreground">
                  {s.used} {s.unit}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <HardDrive className="h-4 w-4 text-primary" /> Cleanup Recommendations
          </div>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-2.5">
              <span>62 GB of temporary files older than 30 days</span>
              <Button size="sm" variant="ghost" className="h-7 text-warning">
                Clear
              </Button>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-2.5">
              <span>44 GB of rotated logs eligible for archive</span>
              <Button size="sm" variant="ghost" className="h-7">
                Archive
              </Button>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-2.5">
              <span>18 GB of orphaned session clips</span>
              <Button size="sm" variant="ghost" className="h-7">
                Review
              </Button>
            </li>
          </ul>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-10">
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            Archive
          </Button>
          <Button variant="outline" className="h-10">
            <Database className="mr-1.5 h-3.5 w-3.5" />
            Backup
          </Button>
          <Button variant="outline" className="h-10">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Cache
          </Button>
        </div>
      </div>
    </div>
  );
}
