import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, FileText, Loader2 } from "lucide-react";
import { PrintableReport, REPORT_SECTIONS } from "./PrintableReport";

/**
 * Builds a real, printable report from the currently selected session's
 * already-fetched real data. No fake generation progress - printing to PDF
 * is a real, instant browser action (`window.print()`), and there is no
 * separate "generate" step to fake a wait for.
 */
export function ReportBuilder({ session, events, status }) {
  const [sections, setSections] = useState(REPORT_SECTIONS.map((s) => s.key));

  function toggle(key) {
    setSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  if (status === "loading") {
    return (
      <div className="glass-panel flex min-h-[300px] items-center justify-center gap-2 rounded-2xl border border-border/60 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading session data…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="glass-panel flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-border/60 p-8 text-center">
        <FileText className="mb-3 h-8 w-8 text-primary" />
        <div className="font-display text-sm font-semibold">No session selected</div>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Select a session from the library below to build a real report from its data.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-border/60 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-primary">
            <FileText className="h-3 w-3" /> Report Builder
          </div>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
            Session {session.id.slice(0, 8)}
          </h2>
        </div>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border/60 bg-card/30 p-3">
        {REPORT_SECTIONS.map((s) => (
          <label
            key={s.key}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-primary/5"
          >
            <Checkbox checked={sections.includes(s.key)} onCheckedChange={() => toggle(s.key)} />
            <span>{s.label}</span>
          </label>
        ))}
      </div>

      <PrintableReport session={session} events={events} sections={sections} />
    </div>
  );
}
