import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Eye,
  Activity,
  Gauge,
  Timer,
  Ruler,
  ScanFace,
  Zap,
  Moon,
  Sparkles,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { analyzeImage, uploadImage, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ImageUploader } from "@/components/image-analysis/ImageUploader";
import { ImageViewer } from "@/components/image-analysis/ImageViewer";
import { EmptyState } from "@/components/image-analysis/EmptyState";
import { AnalysisProgress } from "@/components/image-analysis/AnalysisProgress";
import { ConfidenceGauge } from "@/components/image-analysis/ConfidenceGauge";
import { FatigueGauge } from "@/components/image-analysis/FatigueGauge";
import { MetricsCard } from "@/components/image-analysis/MetricsCard";
import {
  SummaryCard,
  DetectionBreakdown,
  DecisionSummary,
} from "@/components/image-analysis/ResultCards";
import { DownloadCards } from "@/components/image-analysis/DownloadCards";
export const Route = createFileRoute("/_authenticated/image-analysis")({
  head: () => ({
    meta: [
      { title: "Image Analysis — DriveAlert" },
      {
        name: "description",
        content:
          "Upload a driver image and inspect AI drowsiness detection results with landmarks, confidence and fatigue metrics.",
      },
      { property: "og:title", content: "Image Analysis — DriveAlert" },
      {
        property: "og:description",
        content: "Premium computer-vision workbench for single-frame driver drowsiness detection.",
      },
    ],
  }),
  component: ImageAnalysisPage,
});
const STAGES = [
  "Uploading image…",
  "Running detector…",
  "Scoring detections…",
  "Deriving fatigue state…",
];
const DRIVER_STATUS_LABEL = {
  AWAKE: "Awake",
  YAWNING: "Yawning",
  DROWSY: "Drowsy",
  SLEEPING: "Sleeping",
  UNKNOWN: "Unknown",
};
function ImageAnalysisPage() {
  const [image, setImage] = useState(null);
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState(STAGES[0]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [compare, setCompare] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [savedSessionId, setSavedSessionId] = useState(null);
  useEffect(() => {
    if (!image) {
      setStage("idle");
      setResults(null);
      setError(null);
      setProgress(0);
      setSaveStatus("idle");
      setSavedSessionId(null);
      return;
    }
    let cancelled = false;
    setStage("processing");
    setProgress(0);
    setResults(null);
    setError(null);
    setSaveStatus("idle");
    setSavedSessionId(null);

    // The backend does not stream progress for a single request, so this
    // animates toward (not to) 100% while the real request is in flight, and
    // only snaps to 100% once the response actually arrives.
    let p = 0;
    const tick = setInterval(() => {
      p += (90 - p) * 0.1 + 1;
      p = Math.min(p, 90);
      const idx = Math.min(STAGES.length - 1, Math.floor((p / 100) * STAGES.length));
      setStageLabel(STAGES[idx] ?? STAGES[0]);
      setProgress(p);
    }, 200);

    analyzeImage(image.file)
      .then((data) => {
        if (cancelled) return;
        setProgress(100);
        setResults(toViewModel(data));
        setStage("done");
        // Persists the same image as a real session in the background, so it
        // shows up in Detection History and Reports - the on-screen result
        // above is already real and already shown, this just makes it
        // durable. A second, cheap (single-frame) analysis pass server-side.
        setSaveStatus("saving");
        uploadImage(image.file)
          .then((session) => {
            if (cancelled) return;
            setSavedSessionId(session.id);
            setSaveStatus("saved");
          })
          .catch(() => {
            if (cancelled) return;
            setSaveStatus("error");
          });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Analysis failed unexpectedly.");
        setStage("error");
      })
      .finally(() => clearInterval(tick));

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [image]);
  return (
    <div className="min-h-full bg-cockpit">
      {/* Breadcrumb strip */}
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-background/40 px-4 py-2.5 text-xs text-muted-foreground backdrop-blur lg:px-8">
        <Link to="/dashboard" className="hover:text-foreground">
          Cockpit
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>Analysis</span>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">Image Analysis</span>
      </div>

      <div className="mx-auto max-w-[1440px] space-y-8 p-4 lg:p-8">
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_30px_-8px_var(--color-primary)]">
              <ScanFace className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Computer vision · Single frame
              </div>
              <h1 className="font-display truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                Image Analysis
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Upload a driver image and inspect AI detection — bounding boxes, derived EAR/MAR
                proxies, confidence and fatigue state.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-metric text-[11px] text-muted-foreground backdrop-blur sm:block">
              MODEL · Faster R-CNN (scratch)
            </div>
            <Avatar className="h-9 w-9 border border-primary/30">
              <AvatarFallback className="bg-primary/10 text-xs text-primary">AD</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Upload section */}
        <section className="space-y-4">
          <SectionTitle label="Upload" hint="JPG · JPEG · PNG · WEBP up to 25 MB" />
          <ImageUploader image={image} onImage={setImage} />
        </section>

        {/* Preview + processing / results */}
        <AnimatePresence mode="wait">
          {!image ? (
            <motion.section
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState />
            </motion.section>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-4">
                  <SectionTitle label="Preview" hint="Zoom, pan, fullscreen, side-by-side" />
                  <ImageViewer
                    src={image.url}
                    showOverlays={showOverlays && stage === "done"}
                    onToggleOverlays={() => setShowOverlays((v) => !v)}
                    compare={compare}
                    onToggleCompare={() => setCompare((v) => !v)}
                    detections={results?.detections}
                    imageWidth={results?.imageWidth}
                    imageHeight={results?.imageHeight}
                    metrics={results ? { ear: results.ear, mar: results.mar } : null}
                    driverStatus={results?.driverStatus}
                  />
                </div>
                <div className="space-y-4">
                  <SectionTitle label="Status" />
                  {stage === "processing" && (
                    <AnalysisProgress progress={progress} stage={stageLabel} />
                  )}
                  {stage === "error" && (
                    <div className="flex items-start gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-medium">Analysis failed</div>
                        <div className="mt-0.5 text-xs text-destructive/80">{error}</div>
                      </div>
                    </div>
                  )}
                  {stage === "done" && results && (
                    <>
                      <SummaryCard data={results} />
                      <div className="grid grid-cols-2 gap-3">
                        <ConfidenceGauge value={results.confidence * 100} />
                        <FatigueGauge value={results.fatigueScore} />
                      </div>
                    </>
                  )}
                </div>
              </section>

              {stage === "done" && results && (
                <>
                  <SaveStatusBanner status={saveStatus} sessionId={savedSessionId} />

                  <section className="space-y-4">
                    <SectionTitle label="Analysis metrics" hint="Per-frame telemetry" />
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <MetricsCard
                        label="Eye status"
                        value={results.eyesClosed ? "Closed" : "Open"}
                        icon={Eye}
                        tone={
                          results.eyesClosed
                            ? "var(--color-signal-danger)"
                            : "var(--color-signal-awake)"
                        }
                        hint={`EAR proxy ${results.ear != null ? results.ear.toFixed(3) : "N/A"}`}
                      />
                      <MetricsCard
                        label="Mouth status"
                        value={results.yawning ? "Yawning" : "Neutral"}
                        icon={Activity}
                        tone={
                          results.yawning
                            ? "var(--color-signal-drowsy)"
                            : "var(--color-signal-awake)"
                        }
                        hint={`MAR proxy ${results.mar != null ? results.mar.toFixed(3) : "N/A"}`}
                        delay={0.05}
                      />
                      <MetricsCard
                        label="Alert level"
                        value={results.alertLevel}
                        icon={AlertTriangle}
                        tone={
                          results.alertLevel === "DANGER" || results.alertLevel === "EMERGENCY"
                            ? "var(--color-signal-danger)"
                            : results.alertLevel === "WARNING"
                              ? "var(--color-signal-drowsy)"
                              : "var(--color-signal-awake)"
                        }
                        delay={0.1}
                      />
                      <MetricsCard
                        label="Detection confidence"
                        value={(results.confidence * 100).toFixed(1)}
                        unit="%"
                        icon={Gauge}
                        delay={0.15}
                      />
                      <MetricsCard
                        label="Processing time"
                        value={String(results.processingMs)}
                        unit="ms"
                        icon={Timer}
                        delay={0.2}
                      />
                      <MetricsCard
                        label="Image resolution"
                        value={results.resolution}
                        icon={Ruler}
                        delay={0.25}
                      />
                      <MetricsCard
                        label="Yawning"
                        value={results.yawning ? "Yes" : "No"}
                        icon={Zap}
                        tone={
                          results.yawning
                            ? "var(--color-signal-drowsy)"
                            : "var(--color-signal-awake)"
                        }
                        delay={0.3}
                      />
                      <MetricsCard
                        label="Sleep detection"
                        value={results.driverStatus === "Sleeping" ? "Positive" : "Negative"}
                        icon={Moon}
                        tone={
                          results.driverStatus === "Sleeping"
                            ? "var(--color-signal-danger)"
                            : "var(--color-signal-awake)"
                        }
                        delay={0.35}
                      />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <SectionTitle label="Visual analytics" hint="Model reasoning" />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <DetectionBreakdown data={results} />
                      <DecisionSummary data={results} />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <SectionTitle label="Downloads" hint="Report exports" />
                    <DownloadCards />
                  </section>

                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImage(null)}
                      className="text-xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Analyze another image
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
function SectionTitle({ label, hint }) {
  return (
    <div className="flex items-baseline justify-between">
      <div className="flex items-center gap-2">
        <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
        <h2 className="text-metric text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {label}
        </h2>
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
// Maps the backend's analyzeImage() response onto the shape this page's
// components expect. The API has no yaw/pitch (head pose) or a single
// "confidence" scalar - confidence here is the top detection's score, a
// reasonable stand-in that stays honest about what the model actually
// returned (see Backend/app/schemas/analysis.py for the real contract).
function toViewModel(data) {
  const topScore = data.detections.reduce((max, d) => Math.max(max, d.score), 0);
  return {
    driverStatus: DRIVER_STATUS_LABEL[data.driverState] ?? data.driverState,
    alertLevel: data.alertLevel,
    confidence: topScore,
    fatigueScore: data.fatigueScore,
    ear: data.metrics.eyeAspectRatio,
    mar: data.metrics.mouthAspectRatio,
    yawning: data.metrics.yawning,
    eyesClosed: data.metrics.eyesClosed,
    processingMs: Math.round(data.inferenceMs),
    resolution: `${data.imageWidth}×${data.imageHeight}`,
    detections: data.detections,
    imageWidth: data.imageWidth,
    imageHeight: data.imageHeight,
    timestamp: new Date().toISOString(),
  };
}
