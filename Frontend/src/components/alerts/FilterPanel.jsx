import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw, Save } from "lucide-react";
const SEVERITIES = ["safe", "low", "medium", "high", "critical"];
const STATUS = ["new", "acknowledged", "escalated", "resolved"];
const CHANNELS = ["Email", "WhatsApp", "Alarm", "Browser", "SMS"];
const TYPES = [
  "Driver Sleeping",
  "Drowsiness",
  "Eye Closure",
  "Yawning",
  "Head Pose",
  "Camera Offline",
  "AI Failure",
];
export function FilterPanel() {
  return (
    <Card className="glass-panel border-border/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <div className="font-display text-sm font-semibold">Filters</div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]">
            <Save className="h-3 w-3" /> Save
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]">
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            From
          </div>
          <Input type="date" className="h-8 border-border/60 bg-background/40 text-xs" />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">To</div>
          <Input type="date" className="h-8 border-border/60 bg-background/40 text-xs" />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Driver
          </div>
          <Input
            placeholder="All drivers"
            className="h-8 border-border/60 bg-background/40 text-xs"
          />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Session
          </div>
          <Input placeholder="SES-…" className="h-8 border-border/60 bg-background/40 text-xs" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ChipGroup label="Severity" items={SEVERITIES} />
        <ChipGroup label="Status" items={STATUS} />
        <ChipGroup label="Alert type" items={TYPES} />
        <ChipGroup label="Channel" items={CHANNELS} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Min confidence
          </div>
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={70}
            className="w-full accent-primary"
          />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Min fatigue
          </div>
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={40}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <Button size="sm" className="mt-4 w-full">
        Apply filters
      </Button>
    </Card>
  );
}
function ChipGroup({ label, items }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <button
            key={s}
            className="rounded-full border border-border/50 bg-background/40 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground transition-all hover:border-primary/40 hover:text-primary"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
