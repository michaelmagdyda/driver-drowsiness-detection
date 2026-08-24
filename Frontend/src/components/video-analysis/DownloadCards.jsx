import { motion } from "framer-motion";
import { Download, FileSpreadsheet, Braces, Terminal, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
// Every export here is built from data the backend already returned (or, for
// the video, fetched from a real backend-generated file) - there is no PDF
// report pipeline, so that is not offered rather than faked with a
// placeholder download.
const BASE_ITEMS = [
  {
    key: "json",
    label: "JSON results",
    description: "Full analysis payload, as returned by the API",
    icon: Braces,
  },
  {
    key: "csv",
    label: "Per-frame CSV",
    description: "One row per sampled frame",
    icon: FileSpreadsheet,
  },
  {
    key: "log",
    label: "Event log",
    description: "Timeline of state transitions",
    icon: Terminal,
  },
];
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
async function downloadFromUrl(url, filename) {
  // The frontend and backend are different origins, so a plain <a download>
  // pointing cross-origin would just navigate instead of saving - fetching
  // the bytes first and downloading the resulting blob works regardless.
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    download(filename, blob, blob.type || "video/mp4");
  } catch {
    toast.error("Could not download the annotated video", {
      description: "The preview may have expired — re-run the analysis.",
    });
  }
}
function toCsv(frames) {
  const header = "t_sec,driver_state,alert_level,fatigue_score,ear,mar,confidence";
  const rows = frames.map((f) =>
    [
      f.t,
      f.driverState,
      f.alertLevel,
      f.fatigueScore,
      f.eyeAspectRatio ?? "",
      f.mouthAspectRatio ?? "",
      f.confidence ?? "",
    ].join(","),
  );
  return [header, ...rows].join("\n");
}
function toLog(timeline) {
  if (timeline.length === 0) return "No state-transition events were detected in this clip.";
  return timeline
    .map((e) => `[${e.t.toFixed(2)}s] ${e.kind.toUpperCase()} — ${e.label}`)
    .join("\n");
}
export function DownloadCards({ results, baseName = "video-analysis" }) {
  const items = results.previewUrl
    ? [
        {
          key: "video",
          label: "Annotated video",
          description: "MP4 with real boxes + state burned in by the server",
          icon: VideoIcon,
        },
        ...BASE_ITEMS,
      ]
    : BASE_ITEMS;
  const handlers = {
    video: () => downloadFromUrl(results.previewUrl, `${baseName}-annotated.mp4`),
    json: () => download(`${baseName}.json`, JSON.stringify(results, null, 2), "application/json"),
    csv: () => download(`${baseName}-frames.csv`, toCsv(results.frames), "text/csv"),
    log: () => download(`${baseName}-events.log`, toLog(results.timeline), "text/plain"),
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <div className="mt-3">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-[11px] text-muted-foreground">{item.description}</div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                onClick={handlers[item.key]}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
