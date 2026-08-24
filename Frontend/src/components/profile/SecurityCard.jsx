import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Monitor, ShieldCheck, ShieldAlert, LogOut } from "lucide-react";
import { sessionsList, loginHistory, securityRecommendations, securityScore } from "./mockData";
import { cn } from "@/lib/utils";
const SEV = {
  high: "border-rose-400/40 bg-rose-400/10 text-rose-300",
  medium: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  low: "border-sky-400/40 bg-sky-400/10 text-sky-300",
};
function ScoreRing({ value }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const color =
    value >= 80
      ? "var(--color-signal-awake)"
      : value >= 60
        ? "var(--color-signal-drowsy)"
        : "var(--color-signal-danger)";
  return (
    <svg viewBox="0 0 90 90" className="h-24 w-24 -rotate-90">
      <circle cx="45" cy="45" r={r} strokeWidth="8" className="fill-none stroke-border/60" />
      <circle
        cx="45"
        cy="45"
        r={r}
        strokeWidth="8"
        strokeLinecap="round"
        style={{
          stroke: color,
          strokeDasharray: c,
          strokeDashoffset: off,
          transition: "stroke-dashoffset 700ms",
        }}
        className="fill-none"
      />
      <text
        x="45"
        y="49"
        textAnchor="middle"
        className="rotate-90 fill-foreground font-mono text-lg font-semibold"
        transform="rotate(90 45 45)"
      >
        {value}
      </text>
    </svg>
  );
}
export function SecurityCard() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="glass-panel border-border/50 p-5">
        <div className="flex items-center gap-4">
          <ScoreRing value={securityScore} />
          <div>
            <div className="font-display text-base font-semibold">Security score</div>
            <div className="text-xs text-muted-foreground">Improve your posture to reach 90+.</div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-300">
              <ShieldAlert className="h-3 w-3" /> Action needed
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {securityRecommendations.map((r) => (
            <div
              key={r.title}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-2.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                    SEV[r.severity],
                  )}
                >
                  {r.severity}
                </span>
                <span className="text-sm">{r.title}</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                {r.action}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-4">
          <Button variant="outline" size="sm" className="gap-2">
            <KeyRound className="h-3.5 w-3.5" /> Change password
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Enable 2FA{" "}
            <Badge variant="secondary" className="ml-1 text-[10px]">
              Soon
            </Badge>
          </Button>
        </div>
      </Card>

      <Card className="glass-panel border-border/50 p-5 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-sm font-semibold">Active sessions & devices</div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-rose-300 hover:text-rose-200"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out others
          </Button>
        </div>
        <div className="space-y-2">
          {sessionsList.map((s) => (
            <div
              key={s.device}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground">
                  <Monitor className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {s.device}
                    {s.current && (
                      <span className="ml-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.location} · {s.ip}
                  </div>
                </div>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {s.lastActive}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Login history
          </div>
          <div className="overflow-hidden rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Timestamp</th>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Location</th>
                  <th className="px-3 py-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.map((l, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="px-3 py-2 font-mono text-xs">{l.ts}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.ip}</td>
                    <td className="px-3 py-2 text-xs">{l.location}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                          l.result === "success"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : "border-rose-400/40 bg-rose-400/10 text-rose-300",
                        )}
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
      </Card>
    </div>
  );
}
