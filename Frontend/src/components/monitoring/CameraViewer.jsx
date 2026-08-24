import { Camera, Maximize2 } from "lucide-react";
const STATUS_COLOR = {
  AWAKE: "var(--color-signal-awake)",
  YAWNING: "oklch(0.82 0.16 100)",
  DROWSY: "oklch(0.75 0.18 55)",
  SLEEPING: "var(--color-signal-danger)",
};
// Real camera feed via `videoRef` (the parent owns the MediaStream) with a
// real detection-box overlay from the most recent analyzeImage() result -
// no fake face silhouette, landmarks or head-pose vector. Boxes are scaled
// from the source frame's pixel space (`latestResult.imageWidth/Height`) to
// the displayed video element, the same technique EnhancedVideoPlayer uses
// for recorded clips.
export function CameraViewer({
  videoRef,
  running,
  status,
  confidence,
  sessionTime,
  latestResult,
  cameraError,
  onFullscreen,
}) {
  const color = STATUS_COLOR[status] ?? "var(--color-muted-foreground)";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-black/60 shadow-[0_20px_80px_-30px_var(--color-primary)]">
      <div className="relative aspect-video w-full">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />

        {running &&
          latestResult?.detections?.map((det, i) => {
            if (!latestResult.imageWidth || !latestResult.imageHeight) return null;
            const left = (det.box.x1 / latestResult.imageWidth) * 100;
            const top = (det.box.y1 / latestResult.imageHeight) * 100;
            const width = ((det.box.x2 - det.box.x1) / latestResult.imageWidth) * 100;
            const height = ((det.box.y2 - det.box.y1) / latestResult.imageHeight) * 100;
            return (
              <div
                key={i}
                className="pointer-events-none absolute rounded-md border-2"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  borderColor: color,
                  boxShadow: `0 0 12px ${color}`,
                }}
              >
                <div
                  className="absolute -top-6 left-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] backdrop-blur"
                  style={{
                    borderColor: color,
                    color,
                    backgroundColor: "oklch(0.1 0.02 250 / 0.7)",
                  }}
                >
                  {det.label} · {Math.round(det.score * 100)}%
                </div>
              </div>
            );
          })}

        {/* HUD viewfinder frame */}
        <div className="pointer-events-none absolute inset-4 rounded-xl border border-primary/20" />
        {[
          "top-4 left-4 border-t-2 border-l-2",
          "top-4 right-4 border-t-2 border-r-2",
          "bottom-4 left-4 border-b-2 border-l-2",
          "bottom-4 right-4 border-b-2 border-r-2",
        ].map((cls, i) => (
          <div
            key={i}
            className={`pointer-events-none absolute h-8 w-8 border-primary/60 ${cls}`}
          />
        ))}

        {/* Top HUD strip */}
        <div className="absolute inset-x-4 top-4 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em]">
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-black/50 px-2.5 py-1 backdrop-blur">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${running ? "pulse-danger" : ""}`}
              style={{ backgroundColor: running ? color : "var(--color-muted-foreground)" }}
            />
            <span style={{ color: running ? color : undefined }}>
              {running ? "LIVE" : "STANDBY"}
            </span>
          </div>
        </div>

        {/* Bottom HUD strip */}
        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Status
            </div>
            <div className="text-metric text-sm font-semibold" style={{ color }}>
              {status}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <div className="flex flex-col items-end">
              <span>Session</span>
              <span className="text-metric text-sm text-foreground">{sessionTime}</span>
            </div>
            <div className="flex flex-col items-end">
              <span>Confidence</span>
              <span className="text-metric text-sm text-foreground">
                {confidence != null ? `${(confidence * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
            <button
              onClick={onFullscreen}
              className="grid h-8 w-8 place-items-center rounded-md border border-border/60 bg-black/50 text-muted-foreground backdrop-blur transition hover:text-foreground"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Empty / error state */}
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-primary/40 bg-primary/10">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <div className="font-display text-base font-semibold">
                {cameraError ? "Camera unavailable" : "Camera on standby"}
              </div>
              <div className="mt-1 max-w-xs text-xs text-muted-foreground">
                {cameraError ||
                  "Start monitoring to activate your webcam and the AI inference pipeline."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
