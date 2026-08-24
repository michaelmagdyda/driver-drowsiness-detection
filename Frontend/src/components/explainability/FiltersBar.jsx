import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Search } from "lucide-react";
const chips = ["Session", "Driver", "Model", "Date", "Alert Type", "Confidence", "Risk Level"];
export function FiltersBar() {
  return (
    <section className="glass-panel flex flex-col gap-3 rounded-2xl border border-border/50 p-4 md:flex-row md:items-center md:justify-between">
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search sessions, drivers, models…" className="pl-9" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <Button key={c} variant="outline" size="sm" className="h-8 border-border/60 text-xs">
            <Filter className="mr-1.5 h-3 w-3" /> {c}
          </Button>
        ))}
      </div>
    </section>
  );
}
