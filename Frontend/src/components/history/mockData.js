const DRIVERS = [
  { n: "Marcus Chen", a: "MC" },
  { n: "Sofia Ramirez", a: "SR" },
  { n: "James O'Connor", a: "JO" },
  { n: "Aisha Patel", a: "AP" },
  { n: "Lukas Weber", a: "LW" },
  { n: "Yuki Tanaka", a: "YT" },
  { n: "Elena Rossi", a: "ER" },
  { n: "David Kim", a: "DK" },
];
const CAMERAS = ["Cockpit HD - A1", "IR Night Cam", "Dashcam 4K", "Rear-View DMS"];
const MODELS = ["yolov8n-drowsy-v3.2", "yolov8n-drowsy-v3.1", "best.pt (custom)"];
function rand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
export const MOCK_SESSIONS = Array.from({ length: 42 }, (_, i) => {
  const r = (k) => rand(i * 13 + k);
  const driver = DRIVERS[i % DRIVERS.length];
  const type = ["webcam", "video", "image"][i % 3];
  const state = r(1) > 0.75 ? "sleeping" : r(2) > 0.55 ? "drowsy" : "alert";
  const fatigue = Math.round(
    state === "sleeping" ? 78 + r(3) * 22 : state === "drowsy" ? 45 + r(4) * 30 : 8 + r(5) * 30,
  );
  const alerts =
    state === "sleeping"
      ? 6 + Math.floor(r(6) * 10)
      : state === "drowsy"
        ? 2 + Math.floor(r(7) * 5)
        : Math.floor(r(8) * 2);
  const severity =
    state === "sleeping" ? "critical" : state === "drowsy" ? "high" : alerts > 0 ? "medium" : "low";
  const status = state === "sleeping" ? "danger" : state === "drowsy" ? "warning" : "safe";
  const date = new Date(Date.now() - i * 3600_000 * (2 + r(9) * 6));
  const dur = 120 + Math.floor(r(10) * 3600);
  return {
    id: `sess_${(i + 1).toString().padStart(4, "0")}`,
    code: `DA-${(2024010 + i).toString()}`,
    driverName: driver.n,
    driverAvatar: driver.a,
    date: date.toISOString(),
    startTime: date.toISOString(),
    durationSec: dur,
    monitoringType: type,
    camera: CAMERAS[i % CAMERAS.length],
    driverState: state,
    fatigueScore: fatigue,
    confidence: Math.round(78 + r(11) * 21),
    alertCount: alerts,
    status,
    severity,
    avgEar: Number((0.18 + r(12) * 0.15).toFixed(3)),
    avgMar: Number((0.32 + r(13) * 0.25).toFixed(3)),
    processingMs: Math.round(18 + r(14) * 22),
    modelVersion: MODELS[i % MODELS.length],
    yawns: Math.floor(r(15) * 8),
    eyeClosures: Math.floor(r(16) * 12),
    sleepEvents: state === "sleeping" ? 1 + Math.floor(r(17) * 3) : 0,
    recommendations:
      state === "sleeping"
        ? ["Immediate rest required", "Pull over safely", "Schedule medical review"]
        : state === "drowsy"
          ? ["Take a 15-minute break", "Hydrate and stretch", "Reduce shift length"]
          : ["Maintain current alertness", "Continue routine monitoring"],
  };
});
export const MOCK_TIMELINE = [
  { t: "08:01:02", type: "start", label: "Monitoring session started", severity: "info" },
  { t: "08:03:18", type: "yawn", label: "Yawn detected (MAR 0.62)", severity: "low" },
  { t: "08:04:01", type: "eyes-closed", label: "Eyes closed for 1.8s", severity: "medium" },
  { t: "08:04:05", type: "warning", label: "Drowsiness warning triggered", severity: "high" },
  {
    t: "08:04:15",
    type: "sleep",
    label: "Sleep state detected (PERCLOS 0.42)",
    severity: "critical",
  },
  {
    t: "08:05:10",
    type: "recovered",
    label: "Driver recovered — alert state restored",
    severity: "info",
  },
  { t: "08:12:47", type: "yawn", label: "Repeated yawn cluster (3 events)", severity: "medium" },
  { t: "08:18:22", type: "end", label: "Session ended", severity: "info" },
];
export const MOCK_TRENDS = {
  sessionsPerDay: Array.from({ length: 14 }, (_, i) => ({
    day: `D-${13 - i}`,
    sessions: 8 + Math.floor(rand(i + 100) * 22),
  })),
  alertsPerWeek: Array.from({ length: 8 }, (_, i) => ({
    week: `W${i + 1}`,
    alerts: 12 + Math.floor(rand(i + 200) * 40),
  })),
  fatigueTrend: Array.from({ length: 24 }, (_, i) => ({
    h: `${i}:00`,
    fatigue: Math.round(20 + rand(i + 300) * 60),
    confidence: Math.round(75 + rand(i + 400) * 24),
    ear: Number((0.2 + rand(i + 500) * 0.12).toFixed(3)),
    mar: Number((0.3 + rand(i + 600) * 0.25).toFixed(3)),
  })),
  distribution: [
    { name: "Safe", value: 62, color: "var(--color-signal-awake)" },
    { name: "Warning", value: 24, color: "var(--color-signal-drowsy)" },
    { name: "Danger", value: 14, color: "var(--color-signal-danger)" },
  ],
};
export function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s.toString().padStart(2, "0")}s`;
}
