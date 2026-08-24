import { FileDown } from "lucide-react";
import { DownloadCards } from "@/components/history/DownloadCards";

/**
 * Real CSV/JSON/log/recording export for the currently selected session,
 * reusing the exact export logic already built for Detection History.
 * Print/Save-as-PDF lives in `ReportBuilder` instead, since that's where
 * the printable document itself is rendered.
 */
export function ExportCenter({ session, events }) {
  if (!session) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/40 p-4 text-xs text-muted-foreground">
        Select a session above to see its real export options.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <FileDown className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold tracking-tight">Data Export</h2>
      </div>
      <DownloadCards session={session} events={events} />
    </div>
  );
}
