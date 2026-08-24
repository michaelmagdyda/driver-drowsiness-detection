const drivers = [
  { n: "Marcus Chen", i: "MC" },
  { n: "Sofia Ramirez", i: "SR" },
  { n: "James O'Connor", i: "JO" },
  { n: "Aisha Patel", i: "AP" },
  { n: "Lukas Weber", i: "LW" },
  { n: "Yuki Tanaka", i: "YT" },
  { n: "Elena Rossi", i: "ER" },
  { n: "David Kim", i: "DK" },
];
const types = [
  "Driver Sleeping",
  "Driver Drowsiness",
  "Excessive Eye Closure",
  "Continuous Yawning",
  "Head Pose Distraction",
  "Camera Offline",
  "AI Model Failure",
];
const reasons = {
  "Driver Sleeping": {
    r: "Eyes remained closed for 3.2 seconds and PERCLOS exceeded 0.42.",
    a: "Trigger loudest alarm and instruct driver to pull over immediately.",
  },
  "Driver Drowsiness": {
    r: "Fatigue score exceeded 0.72 with sustained low EAR.",
    a: "Escalate to fleet supervisor and recommend a 15-minute rest.",
  },
  "Excessive Eye Closure": {
    r: "Eyes closed for 2.1 seconds — above 1.5s threshold.",
    a: "Send audio prompt and log micro-sleep incident.",
  },
  "Continuous Yawning": {
    r: "4 yawns detected within 60 seconds (MAR > 0.55).",
    a: "Suggest hydration and short break at next safe location.",
  },
  "Head Pose Distraction": {
    r: "Head deviated from forward position for 8 seconds.",
    a: "Prompt driver to re-focus attention on the road.",
  },
  "Camera Offline": {
    r: "No frames received from cockpit camera for 12 seconds.",
    a: "Notify maintenance and switch to backup camera.",
  },
  "AI Model Failure": {
    r: "Inference exception — model returned invalid tensor shape.",
    a: "Restart worker and roll back to previous model version.",
  },
  "Backend Failure": {
    r: "Detection pipeline unreachable — 3 consecutive timeouts.",
    a: "Failover to standby region and page on-call engineer.",
  },
};
function rand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
export const MOCK_ALERTS = Array.from({ length: 28 }, (_, i) => {
  const r = (k) => rand(i * 17 + k);
  const type = types[i % types.length];
  const sev =
    type === "Driver Sleeping" || type === "Backend Failure"
      ? "critical"
      : type === "Driver Drowsiness" || type === "AI Model Failure"
        ? "high"
        : type === "Excessive Eye Closure" || type === "Camera Offline"
          ? "medium"
          : "low";
  const status = i < 4 ? "new" : i < 10 ? "acknowledged" : i < 14 ? "escalated" : "resolved";
  const driver = drivers[i % drivers.length];
  const t = new Date(Date.now() - i * 1000 * 60 * (5 + Math.floor(r(1) * 40)));
  const reason = reasons[type];
  return {
    id: `ALT-${(20260722000 + i).toString()}`,
    timestamp: t.toISOString(),
    driverName: driver.n,
    driverInitials: driver.i,
    sessionId: `SES-${4820 - i}`,
    type,
    severity: sev,
    confidence: Math.round(78 + r(2) * 21),
    fatigue: Math.round(
      sev === "critical" ? 82 + r(3) * 15 : sev === "high" ? 55 + r(4) * 25 : 25 + r(5) * 30,
    ),
    status,
    ear: Number((0.14 + r(6) * 0.15).toFixed(3)),
    mar: Number((0.28 + r(7) * 0.35).toFixed(3)),
    headPose: `Y ${(r(8) * 20 - 10).toFixed(1)}° / P ${(r(9) * 15 - 5).toFixed(1)}°`,
    triggerReason: reason.r,
    suggestedAction: reason.a,
    deliveries: [
      {
        channel: "Email",
        status: r(10) > 0.15 ? "sent" : "failed",
        time: "+00:01",
        retries: 0,
        error: r(10) <= 0.15 ? "SMTP timeout" : undefined,
      },
      {
        channel: "WhatsApp",
        status: r(11) > 0.2 ? "sent" : "pending",
        time: "+00:02",
        retries: r(11) > 0.2 ? 0 : 1,
      },
      { channel: "Sound Alarm", status: "sent", time: "+00:00", retries: 0 },
      { channel: "Browser", status: "queued", time: "—", retries: 0 },
      { channel: "SMS", status: "queued", time: "—", retries: 0 },
    ],
  };
});
export const KPI_STATS = {
  active: 12,
  critical: 3,
  warning: 9,
  resolved: 184,
  emails: 421,
  whatsapp: 358,
  alarms: 92,
  avgResponseSec: 14.6,
};
export const ALERTS_BY_DAY = Array.from({ length: 14 }, (_, i) => ({
  day: `D-${13 - i}`,
  count: 4 + Math.floor(rand(i + 1) * 14),
}));
export const ALERTS_BY_HOUR = Array.from({ length: 24 }, (_, i) => ({
  h: `${i.toString().padStart(2, "0")}h`,
  count: Math.floor(rand(i + 50) * 18) + (i >= 22 || i <= 5 ? 8 : 2),
}));
export const SEVERITY_DIST = [
  { name: "Critical", value: 12, color: "var(--color-signal-danger)" },
  { name: "High", value: 24, color: "oklch(0.78 0.16 55)" },
  { name: "Medium", value: 38, color: "var(--color-signal-drowsy)" },
  { name: "Low", value: 26, color: "var(--color-signal-awake)" },
];
export const ALERT_TYPES_DIST = [
  { name: "Drowsiness", value: 34 },
  { name: "Yawning", value: 22 },
  { name: "Eye Closure", value: 18 },
  { name: "Sleeping", value: 12 },
  { name: "Head Pose", value: 9 },
  { name: "Camera", value: 5 },
];
export const NOTIF_SUCCESS = [
  { channel: "Email", rate: 96 },
  { channel: "WhatsApp", rate: 91 },
  { channel: "Alarm", rate: 99 },
  { channel: "Browser", rate: 88 },
];
export const TIMELINE_MOCK = [
  { t: "08:30:12", label: "Driver started monitoring", severity: "safe" },
  { t: "08:42:17", label: "Yawning detected (MAR 0.61)", severity: "low" },
  { t: "08:43:05", label: "Eyes closed for 1.9s", severity: "medium" },
  { t: "08:43:09", label: "Danger alert triggered", severity: "critical" },
  { t: "08:43:10", label: "Email dispatched", severity: "safe" },
  { t: "08:43:12", label: "Alarm activated", severity: "high" },
  { t: "08:44:03", label: "Driver recovered — alert state restored", severity: "safe" },
];
export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
