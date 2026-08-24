import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Eye, EyeOff, Columns2 } from "lucide-react";
export function ImageViewer({
  src,
  showOverlays,
  onToggleOverlays,
  compare,
  onToggleCompare,
  detections = [],
  imageWidth,
  imageHeight,
  metrics,
  driverStatus,
}) {
  const wrapRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(null);
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const fullscreen = () => wrapRef.current?.requestFullscreen?.();
  const onMouseDown = (e) => {
    if (zoom === 1) return;
    dragging.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = (e) => {
    if (!dragging.current) return;
    setPan({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
  };
  const onMouseUp = () => {
    dragging.current = null;
  };
  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-black/60 backdrop-blur-xl"
    >
      <div
        className="relative aspect-video w-full overflow-hidden bg-[radial-gradient(circle_at_center,oklch(0.2_0.03_240),oklch(0.08_0.02_240))]"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: zoom > 1 ? (dragging.current ? "grabbing" : "grab") : "default" }}
      >
        {compare ? (
          <div className="grid h-full w-full grid-cols-2 gap-px">
            <div className="relative h-full w-full overflow-hidden">
              <img src={src} alt="Original" className="h-full w-full object-contain" />
              <span className="text-metric absolute left-3 top-3 rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
                Original
              </span>
            </div>
            <div className="relative h-full w-full overflow-hidden">
              <ImageWithOverlays
                src={src}
                alt="AI Result"
                detections={detections}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                metrics={metrics}
                driverStatus={driverStatus}
                showOverlays={showOverlays}
              />
              <span className="text-metric absolute left-3 top-3 rounded-md border border-primary/50 bg-primary/15 px-2 py-1 text-[10px] uppercase tracking-widest text-primary backdrop-blur">
                AI Result
              </span>
            </div>
          </div>
        ) : (
          <div
            className="relative h-full w-full transition-transform duration-100"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <ImageWithOverlays
              src={src}
              alt="Driver"
              detections={detections}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              metrics={metrics}
              driverStatus={driverStatus}
              showOverlays={showOverlays}
            />
          </div>
        )}

        {/* Corner viewfinder brackets */}
        {!compare && (
          <div className="pointer-events-none absolute inset-4">
            {[
              "top-0 left-0",
              "top-0 right-0 rotate-90",
              "bottom-0 left-0 -rotate-90",
              "bottom-0 right-0 rotate-180",
            ].map((pos) => (
              <div
                key={pos}
                className={`absolute h-6 w-6 border-t-2 border-l-2 border-primary/70 ${pos}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 border-t border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="text-metric w-14 text-center text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onToggleOverlays} className="text-xs">
            {showOverlays ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Overlays
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleCompare} className="text-xs">
            <Columns2 className="h-3.5 w-3.5" />
            {compare ? "Single" : "Compare"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fullscreen}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
const DETECTION_COLOR = {
  closed_eye: "var(--color-signal-danger)",
  open_eye: "var(--color-signal-awake)",
  yawn: "var(--color-signal-drowsy)",
};
const DETECTION_DISPLAY = { closed_eye: "Closed eye", open_eye: "Open eye", yawn: "Yawn" };

// Wraps the <img> in a div sized exactly to the image's rendered ("contain")
// box, so detection boxes can be positioned with plain percentages of that
// div - no letterbox math needed.
function ImageWithOverlays({
  src,
  alt,
  detections,
  imageWidth,
  imageHeight,
  metrics,
  driverStatus,
  showOverlays,
}) {
  const ratio = imageWidth && imageHeight ? imageWidth / imageHeight : 16 / 9;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative max-h-full max-w-full" style={{ aspectRatio: ratio }}>
        <img src={src} alt={alt} className="pointer-events-none h-full w-full object-contain" />
        {showOverlays && imageWidth && imageHeight && (
          <Overlays
            detections={detections}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            metrics={metrics}
            driverStatus={driverStatus}
          />
        )}
      </div>
    </div>
  );
}
function Overlays({ detections, imageWidth, imageHeight, metrics, driverStatus }) {
  return (
    <>
      {detections.map((det, i) => {
        const color = DETECTION_COLOR[det.label] ?? "var(--color-signal-awake)";
        const left = (det.box.x1 / imageWidth) * 100;
        const top = (det.box.y1 / imageHeight) * 100;
        const width = ((det.box.x2 - det.box.x1) / imageWidth) * 100;
        const height = ((det.box.y2 - det.box.y1) / imageHeight) * 100;
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
              boxShadow: `0 0 16px -4px ${color}`,
            }}
          >
            <div
              className="text-metric absolute -top-5 left-0 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: color, color: "oklch(0.15 0.02 240)" }}
            >
              {DETECTION_DISPLAY[det.label] ?? det.label} · {(det.score * 100).toFixed(0)}%
            </div>
          </div>
        );
      })}

      {/* HUD telemetry */}
      <div className="text-metric pointer-events-none absolute right-4 top-4 space-y-1 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] backdrop-blur">
        <Row label="EAR proxy" value={metrics?.ear != null ? metrics.ear.toFixed(3) : "N/A"} />
        <Row label="MAR proxy" value={metrics?.mar != null ? metrics.mar.toFixed(3) : "N/A"} />
        <Row label="Detections" value={String(detections.length)} />
      </div>

      {/* Status label */}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
        <span className="text-metric flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/15 px-2 py-1 text-[11px] text-primary backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          {driverStatus?.toUpperCase() ?? "ANALYSED"}
        </span>
        <span className="text-metric rounded-md bg-background/70 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
          {new Date().toLocaleTimeString()}
        </span>
      </div>
    </>
  );
}
function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span style={{ color: tone }}>{value}</span>
    </div>
  );
}
