import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Play, Pause, Maximize2, Volume2, VolumeX, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
const SPEEDS = [0.5, 1, 1.5, 2];
const STATE_COLOR = {
  AWAKE: "var(--color-signal-awake)",
  YAWNING: "var(--color-signal-drowsy)",
  DROWSY: "oklch(0.75 0.18 55)",
  SLEEPING: "var(--color-signal-danger)",
  UNKNOWN: "var(--color-muted-foreground)",
};
// Real per-frame telemetry only (EAR/MAR/confidence/state, real detection
// boxes) - no head-pose row, since the backend never produces one, and no
// fixed mock box. `frames` is the sampled sequence from the analyzeVideo()
// response; nearest-by-timestamp is looked up on every playback tick.
function nearestFrame(frames, t) {
  if (!frames || frames.length === 0) return null;
  let closest = frames[0];
  let bestDelta = Math.abs(frames[0].t - t);
  for (const f of frames) {
    const delta = Math.abs(f.t - t);
    if (delta < bestDelta) {
      closest = f;
      bestDelta = delta;
    }
  }
  return closest;
}
export function EnhancedVideoPlayer({
  src,
  frames,
  videoWidth,
  videoHeight,
  showOverlays = true,
  annotated = false,
}) {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [mediaError, setMediaError] = useState(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setMediaError(null);
    const onTime = () => setT(v.currentTime);
    const onMeta = () => setDur(v.duration || 0);
    // Reflect the video's real playback state rather than assuming a click
    // handler's request succeeded - play() can be asynchronously rejected,
    // and the video can also pause/end on its own (native controls, another
    // tab regaining focus, reaching the end of the clip).
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    // Calling play() immediately on mount can silently fail (AbortError) if
    // the browser hasn't buffered enough of a freshly-created blob URL yet -
    // waiting for "canplay" is what makes autoplay reliable here, and also
    // covers a new src being set on the same element (e.g. the user replaces
    // the uploaded clip, where the autoplay *attribute* alone would not fire
    // again in most browsers).
    const onCanPlay = () => v.play().catch(() => setPlaying(false));
    // The browser can genuinely be unable to decode a file the backend
    // accepts fine (e.g. an MPEG-4 Part 2 / "FMP4" AVI - no browser ships a
    // decoder for it, while OpenCV/ffmpeg server-side happily reads it). No
    // amount of retrying play() fixes that, so this is surfaced honestly
    // instead of leaving the preview silently frozen on a black frame.
    const onError = () => setMediaError(v.error?.message || "This format can't be decoded.");
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onError);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
    };
  }, [src]);
  const current = useMemo(() => nearestFrame(frames, t), [frames, t]);
  const play = () => {
    const v = videoRef.current;
    if (!v) return;
    // play() returns a rejected promise (not a thrown error) when the
    // browser blocks or aborts it - reflect that back into `playing` rather
    // than leaving the button optimistically showing "pause".
    v.play().catch(() => setPlaying(false));
  };
  const pause = () => {
    videoRef.current?.pause();
  };
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) play();
    else pause();
  };
  const seek = (v) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = v;
    setT(v);
  };
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };
  const fullscreen = () => wrapRef.current?.requestFullscreen?.();
  const aspectRatio = videoWidth && videoHeight ? `${videoWidth} / ${videoHeight}` : "16 / 9";
  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-black/60 backdrop-blur-xl"
    >
      <div
        className={`relative w-full ${mediaError ? "" : "cursor-pointer"}`}
        style={{ aspectRatio }}
        onClick={mediaError ? undefined : toggle}
      >
        <video
          ref={videoRef}
          src={src}
          className="h-full w-full object-contain"
          muted={muted}
          playsInline
          autoPlay
          loop
        />

        {mediaError ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <div className="text-sm font-medium text-white">Preview unavailable</div>
            <div className="max-w-xs text-xs text-white/70">
              Your browser can't decode this video's format. This only affects the local preview —
              analysis still runs on the server.
            </div>
          </div>
        ) : (
          !playing && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="grid h-14 w-14 place-items-center rounded-full border border-white/30 bg-black/50 text-white backdrop-blur">
                <Play className="h-6 w-6 translate-x-0.5" />
              </div>
            </div>
          )
        )}

        {showOverlays && (
          <>
            {/* The server already burns boxes into the pixels for an annotated
                preview - drawing them again here would double them up. */}
            {!annotated &&
              current?.detections?.map((det, i) => {
                if (!videoWidth || !videoHeight) return null;
                const color = STATE_COLOR[current.driverState] ?? STATE_COLOR.UNKNOWN;
                const left = (det.box.x1 / videoWidth) * 100;
                const top = (det.box.y1 / videoHeight) * 100;
                const width = ((det.box.x2 - det.box.x1) / videoWidth) * 100;
                const height = ((det.box.y2 - det.box.y1) / videoHeight) * 100;
                return (
                  <div
                    key={i}
                    className="pointer-events-none absolute rounded-md border shadow-[0_0_20px_-6px_currentColor]"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                      borderColor: color,
                      color,
                    }}
                  >
                    <div
                      className="text-metric absolute -top-5 left-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-black"
                      style={{ backgroundColor: color }}
                    >
                      {det.label} · {det.score.toFixed(2)}
                    </div>
                  </div>
                );
              })}

            {current && (
              <div className="text-metric pointer-events-none absolute right-4 top-4 space-y-1 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] backdrop-blur">
                <Row label="EAR" value={current.eyeAspectRatio?.toFixed(3) ?? "—"} />
                <Row label="MAR" value={current.mouthAspectRatio?.toFixed(3) ?? "—"} />
                <Row
                  label="Conf"
                  value={
                    current.confidence != null ? `${(current.confidence * 100).toFixed(0)}%` : "—"
                  }
                  tone={STATE_COLOR[current.driverState] ?? STATE_COLOR.UNKNOWN}
                />
                <Row
                  label="State"
                  value={current.driverState}
                  tone={STATE_COLOR[current.driverState] ?? STATE_COLOR.UNKNOWN}
                />
              </div>
            )}

            <div className="text-metric pointer-events-none absolute left-4 top-4 flex items-center gap-2">
              <span className="rounded-md bg-background/70 px-2 py-1 text-[11px] backdrop-blur">
                {formatTime(t)} / {formatTime(dur)}
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/15 px-2 py-1 text-[11px] text-primary backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                Nearest sampled frame
              </span>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl">
        <Slider
          value={[t]}
          min={0}
          max={dur || 1}
          step={0.05}
          onValueChange={(v) => seek(v[0] ?? 0)}
          className="mb-3"
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <div className="text-metric ml-1 text-xs text-muted-foreground">
            {formatTime(t)} / {formatTime(dur)}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleSpeed}
              className="text-metric h-8 text-xs"
            >
              <Gauge className="h-3.5 w-3.5" />
              {speed}×
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fullscreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
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
function formatTime(sec) {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
