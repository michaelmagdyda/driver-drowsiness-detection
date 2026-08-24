import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileJson, ListTree, Video, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
// Every export here is built from data already fetched for this page (or, for
// the video, a real signed Supabase Storage URL) - there is no PDF report
// pipeline, so that is not offered rather than faked with a placeholder.
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
async function downloadRecording(session, filename) {
  try {
    const { data, error } = await supabase.storage
      .from(session.media.bucket)
      .createSignedUrl(session.media.storagePath, 300);
    if (error || !data?.signedUrl) throw error || new Error("no signed URL");
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    download(filename, blob, blob.type || "video/mp4");
  } catch {
    toast.error("Could not download the recording", {
      description: "The stored clip may have been deleted.",
    });
  }
}
function toCsv(events) {
  const header = "ts,state,alert_level,fatigue_score,ear,mar,confidence";
  const rows = events.map((e) =>
    [
      e.ts,
      e.state,
      e.alertLevel,
      e.fatigueScore ?? "",
      e.ear ?? "",
      e.mar ?? "",
      e.confidence ?? "",
    ].join(","),
  );
  return [header, ...rows].join("\n");
}
function toLog(events) {
  if (events.length === 0) return "No detection events were recorded for this session.";
  return events
    .map((e) => `[${e.ts}] ${e.state} / ${e.alertLevel} — fatigue ${e.fatigueScore ?? "—"}`)
    .join("\n");
}
export function DownloadCards({ session, events }) {
  const baseName = `session-${session.id.slice(0, 8)}`;
  const items = [
    ...(session.media
      ? [
          {
            key: "video",
            label: "Recording",
            description: "Annotated MP4, as stored",
            icon: Video,
          },
        ]
      : []),
    {
      key: "json",
      label: "JSON results",
      description: "Session + events, as returned by the API",
      icon: FileJson,
    },
    {
      key: "csv",
      label: "Per-event CSV",
      description: "One row per detection event",
      icon: FileSpreadsheet,
    },
    { key: "log", label: "Event log", description: "Plain-text detection log", icon: ListTree },
  ];
  const handlers = {
    video: () => downloadRecording(session, `${baseName}.mp4`),
    json: () =>
      download(
        `${baseName}.json`,
        JSON.stringify({ session, events }, null, 2),
        "application/json",
      ),
    csv: () => download(`${baseName}-events.csv`, toCsv(events), "text/csv"),
    log: () => download(`${baseName}-events.log`, toLog(events), "text/plain"),
  };
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.key}
          className="glass-panel group border-border/50 p-4 transition-all hover:border-primary/40"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <item.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="font-display text-sm font-semibold">{item.label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{item.description}</div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-primary/30 text-primary hover:bg-primary/10"
              onClick={handlers[item.key]}
            >
              <Download className="mr-1 h-3 w-3" /> Download
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
