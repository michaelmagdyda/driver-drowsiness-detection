import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { auditLogs } from "./mockData";
export function AuditLogTable() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState("all");
  const filtered = useMemo(
    () =>
      auditLogs.filter((l) => {
        const match = (l.user + l.action + l.module + l.ip).toLowerCase().includes(q.toLowerCase());
        const r = result === "all" || l.result === result;
        return match && r;
      }),
    [q, result],
  );
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search audit trail…"
            className="border-border/60 bg-background/40 pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {["all", "success", "failed"].map((r) => (
            <button
              key={r}
              onClick={() => setResult(r)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                result === r
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-8">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="p-3">Timestamp</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Module</th>
              <th className="p-3">IP Address</th>
              <th className="p-3">Result</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                <td className="p-3 text-metric text-xs text-muted-foreground">{l.ts}</td>
                <td className="p-3 text-xs">{l.user}</td>
                <td className="p-3">
                  <code className="rounded-md border border-border/50 bg-background/40 px-1.5 py-0.5 text-[11px]">
                    {l.action}
                  </code>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{l.module}</td>
                <td className="p-3 text-metric text-xs text-muted-foreground">{l.ip}</td>
                <td className="p-3">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                      l.result === "success"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {l.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
