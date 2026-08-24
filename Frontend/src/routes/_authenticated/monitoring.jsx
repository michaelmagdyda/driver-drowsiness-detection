import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Play,
  Pause,
  Square,
  Camera,
  Maximize2,
  Eye,
  Smile,
  Gauge,
  Timer,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { CameraViewer } from "@/components/monitoring/CameraViewer";
import { FatigueGauge } from "@/components/monitoring/FatigueGauge";
import { MetricCard } from "@/components/monitoring/MetricCard";
import { Timeline } from "@/components/monitoring/Timeline";
import { analyzeImage, completeSession, ApiError } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/monitoring")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Live Monitoring — DriveAlert Cockpit" },
      {
        name: "description",
        content:
          "Real-time driver drowsiness monitoring with live camera feed, fatigue telemetry and event timeline.",
      },
      { property: "og:title", content: "Live Monitoring — DriveAlert" },
      {
        property: "og:description",
        content: "Cockpit-grade driver monitoring: EAR, MAR and fatigue score in real time.",
      },
    ],
  }),
  component: MonitoringPage,
});

const STATUS_LEVEL = {
  AWAKE: "SAFE",
  YAWNING: "WARNING",
  DROWSY: "DANGER",
  SLEEPING: "EMERGENCY",
  UNKNOWN: "SAFE",
};
const LEVEL_COLOR = {
  SAFE: "var(--color-signal-awake)",
  WARNING: "var(--color-signal-drowsy)",
  DANGER: "oklch(0.75 0.18 55)",
  EMERGENCY: "var(--color-signal-danger)",
};
const TICK_MS = 1000;

function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function eventForTransition(nextState) {
  if (nextState === "YAWNING") return { kind: "yawn", label: "Yawning detected" };
  if (nextState === "SLEEPING") return { kind: "sleep", label: "Sleep warning triggered" };
  if (nextState === "AWAKE") return { kind: "recovered", label: "Driver recovered" };
  return null;
}

function MonitoringPage() {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [sessionSec, setSessionSec] = useState(0);
  const [status, setStatus] = useState("AWAKE");
  const [fatigue, setFatigue] = useState(0);
  const [ear, setEar] = useState(null);
  const [mar, setMar] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [latestResult, setLatestResult] = useState(null);
  const [series, setSeries] = useState([]);
  const [events, setEvents] = useState([]);
  const [yawnCount, setYawnCount] = useState(0);
  const [closureCount, setClosureCount] = useState(0);
  const [longestClosureSec, setLongestClosureSec] = useState(0);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error

  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(null);
  const rawEventsRef = useRef([]);
  const prevStateRef = useRef("AWAKE");
  const closureStartRef = useRef(null);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function tick() {
    setSessionSec((s) => s + 1);
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return;

    let result;
    try {
      result = await analyzeImage(new File([blob], "frame.jpg", { type: "image/jpeg" }));
    } catch {
      return; // transient inference failure - skip this tick, keep monitoring
    }

    const t = (Date.now() - startedAtRef.current.getTime()) / 1000;
    const topScore = result.detections.length
      ? Math.max(...result.detections.map((d) => d.score))
      : null;

    setLatestResult(result);
    setStatus(result.driverState);
    setFatigue(result.fatigueScore);
    setEar(result.metrics.eyeAspectRatio);
    setMar(result.metrics.mouthAspectRatio);
    setConfidence(topScore);
    setSeries((prev) =>
      [
        ...prev,
        {
          t: Math.round(t),
          ear: result.metrics.eyeAspectRatio ?? 0,
          mar: result.metrics.mouthAspectRatio ?? 0,
          fatigue: result.fatigueScore,
          confidence: (topScore ?? 0) * 100,
        },
      ].slice(-60),
    );
    rawEventsRef.current.push({
      t,
      ear: result.metrics.eyeAspectRatio,
      mar: result.metrics.mouthAspectRatio,
      eyeClosed: result.metrics.eyesClosed,
      yawning: result.metrics.yawning,
      driverState: result.driverState,
      alertLevel: result.alertLevel,
      fatigueScore: result.fatigueScore,
      detections: result.detections,
    });

    if (result.metrics.eyesClosed && closureStartRef.current === null) {
      closureStartRef.current = t;
    } else if (!result.metrics.eyesClosed && closureStartRef.current !== null) {
      const duration = t - closureStartRef.current;
      setLongestClosureSec((prev) => Math.max(prev, duration));
      closureStartRef.current = null;
    }

    if (result.driverState !== prevStateRef.current) {
      const entry = eventForTransition(result.driverState);
      if (entry) {
        const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
        setEvents((prev) => [{ id: `e${Date.now()}`, time, ...entry }, ...prev].slice(0, 20));
        if (entry.kind === "yawn") setYawnCount((n) => n + 1);
        if (entry.kind === "sleep") setClosureCount((n) => n + 1);
      }
      prevStateRef.current = result.driverState;
    }
  }

  async function start() {
    setCameraError(null);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera access was denied. Allow camera permissions and try again."
          : "Could not access a camera on this device.",
      );
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;

    startedAtRef.current = new Date();
    rawEventsRef.current = [];
    prevStateRef.current = "AWAKE";
    closureStartRef.current = null;
    setSeries([]);
    setEvents([]);
    setYawnCount(0);
    setClosureCount(0);
    setLongestClosureSec(0);
    setSessionSec(0);
    setStatus("AWAKE");
    setFatigue(0);
    setEar(null);
    setMar(null);
    setConfidence(null);
    setLatestResult(null);
    setSaveStatus("idle");
    setPaused(false);
    setRunning(true);

    intervalRef.current = setInterval(tick, TICK_MS);
  }

  function pause() {
    if (recorderRef.current?.state === "recording") recorderRef.current.pause();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPaused(true);
  }

  function resume() {
    if (recorderRef.current?.state === "paused") recorderRef.current.resume();
    intervalRef.current = setInterval(tick, TICK_MS);
    setPaused(false);
  }

  async function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
    setPaused(false);

    const recorder = recorderRef.current;
    const collectedEvents = rawEventsRef.current;
    const startedAt = startedAtRef.current;

    if (recorder && recorder.state !== "inactive") {
      await new Promise((resolve) => {
        recorder.onstop = resolve;
        recorder.stop();
      });
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;

    if (collectedEvents.length === 0 || chunksRef.current.length === 0) {
      setSaveStatus("idle");
      return;
    }

    setSaveStatus("saving");
    try {
      const recordingBlob = new Blob(chunksRef.current, {
        type: recorder?.mimeType || "video/webm",
      });
      await completeSession({ events: collectedEvents, startedAt, recordingBlob });
      setSaveStatus("saved");
      toast.success("Session saved", { description: "View it in Detection History." });
    } catch (err) {
      setSaveStatus("error");
      toast.error("Could not save the session", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      });
    }
  }

  function snapshot() {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snapshot-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/jpeg");
  }

  const level = STATUS_LEVEL[status];
  const levelColor = LEVEL_COLOR[level];
  const sparkEar = useMemo(() => series.slice(-16).map((s) => s.ear), [series]);
  const sparkMar = useMemo(() => series.slice(-16).map((s) => s.mar), [series]);
  const avgEar = useMemo(
    () => (series.length ? series.reduce((sum, s) => sum + s.ear, 0) / series.length : 0),
    [series],
  );
  const avgMar = useMemo(
    () => (series.length ? series.reduce((sum, s) => sum + s.mar, 0) / series.length : 0),
    [series],
  );
  const avgConfidence = useMemo(
    () =>
      series.length ? series.reduce((sum, s) => sum + s.confidence, 0) / series.length / 100 : 0,
    [series],
  );
  const peakFatigue = useMemo(
    () => (series.length ? Math.round(Math.max(...series.map((s) => s.fatigue))) : 0),
    [series],
  );

  return (
    <div className="min-h-screen bg-cockpit">
      {/* Sub-header: monitoring controls */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/60 px-4 py-3 backdrop-blur-xl lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${running && !paused ? "pulse-danger" : ""}`}
              style={{ backgroundColor: running ? levelColor : "var(--color-muted-foreground)" }}
            />
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Session
            </div>
            <div className="text-metric text-sm font-medium">{fmtDuration(sessionSec)}</div>
            <Badge
              variant="outline"
              className="ml-1 border-border/60 bg-card/40 text-[10px] uppercase tracking-[0.18em]"
              style={{ color: levelColor, borderColor: `${levelColor}60` }}
            >
              {level}
            </Badge>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <div className="flex flex-wrap items-center gap-2">
            {!running ? (
              <Button
                onClick={start}
                className="h-9 gap-1.5 bg-primary text-primary-foreground shadow-[0_0_24px_-6px_var(--color-primary)] hover:bg-primary/90"
              >
                <Play className="h-3.5 w-3.5" /> Start Monitoring
              </Button>
            ) : paused ? (
              <Button onClick={resume} className="h-9 gap-1.5">
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
            ) : (
              <Button variant="secondary" onClick={pause} className="h-9 gap-1.5">
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            )}
            <Button
              variant="outline"
              onClick={stop}
              disabled={!running}
              className="h-9 gap-1.5 border-border/60 bg-card/40"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5"
              onClick={snapshot}
              disabled={!running}
            >
              <Camera className="h-3.5 w-3.5" /> Snapshot
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => wrapRef.current?.requestFullscreen?.()}
            >
              <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving session…
              </span>
            )}
            {saveStatus === "saved" && <span className="text-primary">Session saved</span>}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Save failed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:p-6">
        {/* LEFT COLUMN — Camera + telemetry + charts + timeline */}
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <motion.div ref={wrapRef} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <CameraViewer
              videoRef={videoRef}
              running={running && !paused}
              confidence={confidence}
              sessionTime={fmtDuration(sessionSec)}
              status={status}
              latestResult={latestResult}
              cameraError={cameraError}
              onFullscreen={() => wrapRef.current?.requestFullscreen?.()}
            />
          </motion.div>

          {/* Telemetry row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="EAR"
              value={ear != null ? ear.toFixed(3) : "—"}
              icon={Eye}
              tone={
                ear != null && ear < 0.22
                  ? "danger"
                  : ear != null && ear < 0.26
                    ? "drowsy"
                    : "awake"
              }
              sparkline={sparkEar}
              delta="derived proxy, not measured"
            />
            <MetricCard
              label="MAR"
              value={mar != null ? mar.toFixed(3) : "—"}
              icon={Smile}
              tone={mar != null && mar > 0.65 ? "drowsy" : "awake"}
              sparkline={sparkMar}
              delta="derived proxy, not measured"
            />
            <MetricCard
              label="Confidence"
              value={confidence != null ? (confidence * 100).toFixed(1) : "—"}
              unit={confidence != null ? "%" : ""}
              icon={Gauge}
              delta="strongest detection this tick"
            />
            <MetricCard
              label="Session"
              value={fmtDuration(sessionSec)}
              icon={Timer}
              delta={running ? (paused ? "paused" : "recording") : "idle"}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartPanel title="Fatigue Score" subtitle="0 – 100 · per-frame classifier">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={series} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fatigue-grad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={levelColor} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={levelColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="fatigue"
                    stroke={levelColor}
                    strokeWidth={2}
                    fill="url(#fatigue-grad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="EAR / MAR" subtitle="Live derived ratios">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={series} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ear"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="mar"
                    stroke="var(--color-signal-drowsy)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          {/* Session summary */}
          <Panel title="Session Summary" subtitle="Live aggregate for the current session">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Monitoring", value: fmtDuration(sessionSec) },
                { label: "Yawns", value: yawnCount },
                { label: "Eye closures", value: closureCount },
                { label: "Longest closure", value: `${longestClosureSec.toFixed(1)}s` },
                { label: "Avg EAR", value: avgEar.toFixed(3) },
                { label: "Avg MAR", value: avgMar.toFixed(3) },
                { label: "Avg confidence", value: `${(avgConfidence * 100).toFixed(1)}%` },
                { label: "Peak fatigue", value: peakFatigue },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border/60 bg-card/40 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {k.label}
                  </div>
                  <div className="mt-1 text-metric text-lg font-semibold">{k.value}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* RIGHT COLUMN — Panels */}
        <aside className="flex flex-col gap-4 lg:gap-6">
          {/* Driver status */}
          <Panel title="Driver Status" subtitle="Real-time classification" accent={levelColor}>
            <div className="flex flex-col items-center gap-3">
              <FatigueGauge value={fatigue} size={220} />
              <div className="grid w-full grid-cols-4 gap-1.5">
                {["AWAKE", "YAWNING", "DROWSY", "SLEEPING"].map((s) => {
                  const active = s === status;
                  const c = LEVEL_COLOR[STATUS_LEVEL[s]];
                  return (
                    <div
                      key={s}
                      className="flex flex-col items-center gap-1 rounded-md border p-2 text-[9px] font-semibold uppercase tracking-[0.16em] transition"
                      style={{
                        borderColor: active ? `${c}70` : "var(--color-border)",
                        backgroundColor: active ? `${c}15` : "transparent",
                        color: active ? c : "var(--color-muted-foreground)",
                        boxShadow: active ? `inset 0 0 20px -6px ${c}` : undefined,
                      }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: active ? c : "var(--color-muted-foreground)",
                          boxShadow: active ? `0 0 6px ${c}` : undefined,
                        }}
                      />
                      {s}
                    </div>
                  );
                })}
              </div>
              <div className="grid w-full grid-cols-4 gap-1.5">
                {["SAFE", "WARNING", "DANGER", "EMERGENCY"].map((l) => {
                  const active = l === level;
                  const c = LEVEL_COLOR[l];
                  return (
                    <div
                      key={l}
                      className="rounded-md border py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.16em]"
                      style={{
                        borderColor: active ? `${c}70` : "var(--color-border)",
                        backgroundColor: active ? `${c}20` : "transparent",
                        color: active ? c : "var(--color-muted-foreground)",
                      }}
                    >
                      {l}
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          {/* Event timeline */}
          <Panel title="Event Timeline" subtitle="Detected state transitions">
            <ScrollArea className="h-[280px] pr-2">
              {events.length > 0 ? (
                <Timeline events={events} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  No state transitions yet this session.
                </p>
              )}
            </ScrollArea>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
function Panel({ title, subtitle, accent, children }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl lg:p-5">
      {accent && (
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
function ChartPanel({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="font-display text-sm font-semibold tracking-tight">{title}</div>
          {subtitle && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
