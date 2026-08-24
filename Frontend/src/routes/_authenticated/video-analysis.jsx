import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronRight,
  Play,
  RotateCcw,
  Sparkles,
  Video as VideoIcon,
  Clock,
  MonitorPlay,
  HardDrive,
  Film,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoUploader } from "@/components/video-analysis/VideoUploader";
import { AnalysisSettings, DEFAULT_CONFIG } from "@/components/video-analysis/AnalysisSettings";
import { ProcessingStatus } from "@/components/video-analysis/ProcessingStatus";
import { ResultsSummary } from "@/components/video-analysis/ResultsSummary";
import { EnhancedVideoPlayer } from "@/components/video-analysis/EnhancedVideoPlayer";
import { Timeline } from "@/components/monitoring/Timeline";
import { AnalyticsCharts } from "@/components/video-analysis/AnalyticsCharts";
import { DownloadCards } from "@/components/video-analysis/DownloadCards";
import { EmptyState } from "@/components/video-analysis/EmptyState";
import { analyzeVideo, uploadVideo, ApiError } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/video-analysis")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Video Analysis · DriveAlert" },
      {
        name: "description",
        content:
          "Upload a driving video and review AI-powered drowsiness detection with per-frame metrics, event timeline and downloadable reports.",
      },
      { property: "og:title", content: "Video Analysis · DriveAlert" },
      {
        property: "og:description",
        content: "Frame-accurate fatigue analytics for uploaded driving recordings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideoAnalysisPage,
});

const STATE_COLOR = {
  AWAKE: "var(--color-signal-awake)",
  YAWNING: "var(--color-signal-drowsy)",
  DROWSY: "oklch(0.75 0.18 55)",
  SLEEPING: "var(--color-signal-danger)",
  UNKNOWN: "var(--color-muted-foreground)",
};

function titleCase(word) {
  if (!word) return "Unknown";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function VideoAnalysisPage() {
  const [video, setVideo] = useState(null);
  const [meta, setMeta] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [savedSessionId, setSavedSessionId] = useState(null);
  const rafRef = useRef(null);
  const startedRef = useRef(0);

  const estimatedTotalFrames = useMemo(
    () => Math.max(1, Math.round((meta?.durationSec ?? 60) * config.sampleRate)),
    [meta, config.sampleRate],
  );
  const totalFrames = results?.sampledFrameCount ?? estimatedTotalFrames;
  const framesProcessed =
    stage === "done" ? totalFrames : Math.round((progress / 100) * estimatedTotalFrames);

  // Probe basic metadata when a new video is selected. Superseded by the
  // backend's own measurement (authoritative) once analysis completes.
  useEffect(() => {
    if (!video) {
      setMeta(null);
      return;
    }
    const el = document.createElement("video");
    el.preload = "metadata";
    el.src = video.url;
    el.onloadedmetadata = () => {
      setMeta({
        durationSec: el.duration || 0,
        width: el.videoWidth || 0,
        height: el.videoHeight || 0,
      });
    };
  }, [video]);

  useEffect(() => {
    setStage("idle");
    setProgress(0);
    setResults(null);
    setSaveStatus("idle");
    setSavedSessionId(null);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [video]);

  // Persists the same clip as a real session, in the background, so it
  // shows up in Detection History and Reports - the on-screen results above
  // are already real and already shown; this just makes them durable. Not
  // awaited by the UI, since re-running the pipeline server-side takes as
  // long as the analysis the user already waited for once.
  async function persistSession(file, sampleRate) {
    setSaveStatus("saving");
    try {
      const session = await uploadVideo(file, sampleRate);
      setSavedSessionId(session.id);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  async function startAnalysis() {
    if (!video) {
      toast.error("Upload a video first.");
      return;
    }
    setStage("processing");
    setProgress(0);
    setResults(null);
    startedRef.current = performance.now();

    // Real processing time cannot be known in advance (it depends on clip
    // length and CPU load), so this is a bounded, ever-slowing estimate that
    // never claims completion until the response actually arrives.
    const estimatedMs = Math.max(3000, estimatedTotalFrames * 180);
    const tick = () => {
      const elapsed = performance.now() - startedRef.current;
      setProgress(Math.min(95, (elapsed / estimatedMs) * 95));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    try {
      const data = await analyzeVideo(video.file, config.sampleRate);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setProgress(100);
      setResults(data);
      setStage("done");
      toast.success("Analysis complete", { description: "Results ready below." });
      persistSession(video.file, config.sampleRate);
    } catch (error) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setStage("idle");
      setProgress(0);
      const message = error instanceof ApiError ? error.message : "Video analysis failed.";
      toast.error("Analysis failed", { description: message });
    }
  }

  function resetAll() {
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
    setStage("idle");
    setProgress(0);
    setResults(null);
    setConfig(DEFAULT_CONFIG);
    setSaveStatus("idle");
    setSavedSessionId(null);
  }

  const displayWidth = results?.videoWidth ?? meta?.width;
  const displayHeight = results?.videoHeight ?? meta?.height;
  const displayDuration = results?.videoDurationSec ?? meta?.durationSec;

  const summaryData = results
    ? {
        driverStatus: titleCase(results.summary.driverState),
        fatigueScore: results.summary.fatigueScore,
        totalYawns: results.summary.totalYawns,
        longestEyeClosureSec: results.summary.longestEyeClosureSec,
        avgEar: results.summary.avgEyeAspectRatio,
        avgMar: results.summary.avgMouthAspectRatio,
        avgConfidence: results.summary.avgConfidence,
        totalAlerts: results.summary.totalAlerts,
        sessionDurationSec: results.summary.sessionDurationSec,
      }
    : null;

  const trend = useMemo(
    () =>
      (results?.frames ?? []).map((f) => ({
        t: formatShort(f.t),
        ear: f.eyeAspectRatio,
        mar: f.mouthAspectRatio,
        fatigue: f.fatigueScore,
        confidence: f.confidence,
      })),
    [results],
  );

  const timeline = useMemo(
    () =>
      (results?.timeline ?? []).map((e, i) => ({
        id: String(i),
        time: formatShort(e.t),
        label: e.label,
        kind: e.kind,
      })),
    [results],
  );

  const alertsPerMinute = useMemo(() => {
    if (!results) return [];
    const minutes = Math.max(1, Math.ceil((results.videoDurationSec || 1) / 60));
    const buckets = Array.from({ length: minutes }, () => 0);
    for (const f of results.frames) {
      if (f.alertLevel !== "SAFE") {
        const bucket = Math.min(minutes - 1, Math.floor(f.t / 60));
        buckets[bucket] += 1;
      }
    }
    return buckets.map((count, i) => ({ minute: `m${i + 1}`, alerts: count }));
  }, [results]);

  const distribution = useMemo(
    () =>
      (results?.distribution ?? []).map((d) => ({
        name: titleCase(d.state),
        value: d.count,
        color: STATE_COLOR[d.state] ?? STATE_COLOR.UNKNOWN,
      })),
    [results],
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 lg:px-8 lg:py-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Cockpit</span>
          <ChevronRight className="h-3 w-3" />
          <span>Analysis</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">Video Analysis</span>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Video Analysis
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Run the DriveAlert AI pipeline on a recorded driving clip. Frames are sampled and run
              through the same detector as Image Analysis, then aggregated into a fatigue timeline.
            </p>
          </div>
        </div>
      </div>

      {/* Upload */}
      <section className="space-y-3">
        <SectionHeader
          eyebrow="Step 1"
          title="Upload"
          description="Drop a driving recording to begin. The file is sent to the backend only when you start analysis."
        />
        <VideoUploader video={video} onVideo={setVideo} />
      </section>

      {!video && <EmptyState />}

      {video && (
        <>
          {/* Preview */}
          <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-3">
              <SectionHeader
                eyebrow="Preview"
                title={results?.previewUrl ? "Annotated video" : "Video preview"}
                description={
                  results?.previewUrl
                    ? "Real detection boxes burned into the clip by the server — download-ready."
                    : "Verify the clip before running the pipeline."
                }
              />
              <EnhancedVideoPlayer
                src={results?.previewUrl || video.url}
                frames={results?.frames}
                videoWidth={displayWidth}
                videoHeight={displayHeight}
                showOverlays={stage === "done"}
                annotated={Boolean(results?.previewUrl)}
              />
            </div>
            <div className="space-y-3">
              <SectionHeader eyebrow="Metadata" title="File details" />
              <div className="grid grid-cols-2 gap-2">
                <MetaTile
                  icon={Clock}
                  label="Duration"
                  value={displayDuration ? formatDur(displayDuration) : "—"}
                />
                <MetaTile
                  icon={MonitorPlay}
                  label="Resolution"
                  value={displayWidth && displayHeight ? `${displayWidth}×${displayHeight}` : "—"}
                />
                <MetaTile
                  icon={Film}
                  label="Source fps"
                  value={results ? `${results.sourceFps} fps` : "—"}
                />
                <MetaTile
                  icon={HardDrive}
                  label="File size"
                  value={`${video.sizeMB.toFixed(1)} MB`}
                />
                <MetaTile
                  icon={VideoIcon}
                  label="Container"
                  value={video.file.name.split(".").pop()?.toUpperCase() ?? "—"}
                />
                <MetaTile icon={Calendar} label="Recorded" value="—" />
              </div>
            </div>
          </section>

          {/* Settings */}
          <section className="space-y-3">
            <SectionHeader
              eyebrow="Step 2"
              title="Analysis configuration"
              description="The only setting that changes what actually runs — everything else in the pipeline is fixed."
            />
            <AnalysisSettings
              config={config}
              onChange={setConfig}
              disabled={stage === "processing"}
            />
          </section>

          {/* Actions */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">Ready to run analysis</div>
                <div className="text-[11px] text-muted-foreground">
                  Will sample ~{estimatedTotalFrames.toLocaleString()} frames at {config.sampleRate}{" "}
                  fps · the server may reduce this for a long clip
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={resetAll} className="text-muted-foreground">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                onClick={startAnalysis}
                disabled={stage === "processing"}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Play className="h-4 w-4" />
                {stage === "done" ? "Re-run analysis" : "Start analysis"}
              </Button>
            </div>
          </section>

          {/* Processing */}
          {stage !== "idle" && (
            <section className="space-y-3">
              <SectionHeader eyebrow="Step 3" title="Processing" />
              <ProcessingStatus
                stage={stage === "done" ? "done" : "inference"}
                progress={progress}
                framesProcessed={framesProcessed}
                totalFrames={totalFrames}
                etaSeconds={Math.max(0, ((100 - progress) / 100) * 8)}
              />
            </section>
          )}

          {/* Results */}
          {stage === "done" && results && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <SaveStatusBanner status={saveStatus} sessionId={savedSessionId} />

              <section className="space-y-3">
                <SectionHeader
                  eyebrow="Results"
                  title="Analysis summary"
                  description="Aggregate metrics for the full clip."
                />
                <ResultsSummary data={summaryData} />
              </section>

              <section className="space-y-3">
                <SectionHeader
                  eyebrow="Timeline"
                  title="Detected events"
                  description="Chronological log of real state transitions."
                />
                <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
                  {timeline.length > 0 ? (
                    <Timeline events={timeline} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No state transitions were detected in this clip.
                    </p>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <SectionHeader
                  eyebrow="Analytics"
                  title="Per-frame telemetry"
                  description={`Trends across ${results.sampledFrameCount} sampled frames (${results.sampleFps} fps).`}
                />
                <AnalyticsCharts
                  trend={trend}
                  alertsPerMinute={alertsPerMinute}
                  distribution={distribution}
                />
              </section>

              <section className="space-y-3">
                <SectionHeader
                  eyebrow="Export"
                  title="Download results"
                  description="Generated locally from the real analysis response — nothing further to fetch."
                />
                <DownloadCards
                  results={results}
                  baseName={video.file.name.replace(/\.[^.]+$/, "")}
                />
              </section>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
function SaveStatusBanner({ status, sessionId }) {
  if (status === "saving") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-4 py-2.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving to Detection History…
      </div>
    );
  }
  if (status === "saved") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        <span>Saved to Detection History.</span>
        <Link
          to="/history"
          search={{ session: sessionId }}
          className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          View in History <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> Could not save this analysis to Detection History.
      </div>
    );
  }
  return null;
}
function SectionHeader({ eyebrow, title, description }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary/80">
        {eyebrow}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
function MetaTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-metric mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}
function formatDur(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
function formatShort(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
