import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { systemLogs } from "./mockData";
const sevColor = {
  info: "text-info border-info/40 bg-info/10",
  warn: "text-warning border-warning/40 bg-warning/10",
  error: "text-destructive border-destructive/40 bg-destructive/10",
  debug: "text-muted-foreground border-muted-foreground/30 bg-muted/40",
};
const categories = ["all", "backend", "ai", "api", "auth", "notification"];
export function SystemLogViewer() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const filtered = useMemo(
    () =>
      systemLogs.filter((l) => {
        const m = (l.message + l.source).toLowerCase().includes(q.toLowerCase());
        const c = cat === "all" || l.source === cat;
        return m && c;
      }),
    [q, cat],
  );
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition-colors ${
                cat === c
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "all" ? "All logs" : `${c} logs`}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search log stream…"
            className="border-border/60 bg-background/40 pl-9"
          />
        </div>
        <Button size="sm" variant="outline" className="h-8">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Download
        </Button>
      </div>
      <div className="max-h-[380px] overflow-y-auto p-3 font-mono text-xs">
        {filtered.map((l, i) => (
          <div
            key={i}
            className="flex items-start gap-3 border-b border-border/30 py-1.5 last:border-0"
          >
            <span className="text-metric text-muted-foreground">{l.ts}</span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${sevColor[l.severity]}`}
            >
              {l.severity}
            </span>
            <span className="text-muted-foreground">[{l.source}]</span>
            <span className="min-w-0 flex-1 truncate text-foreground/90">{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
