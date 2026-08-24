export const sessionMeta = {
  sessionId: "SES-2026-07-22-0417",
  driver: "Karim Al-Sayed",
  vehicle: "Fleet-A · Unit 214",
  modelVersion: "yolo-drowsy-v4.2.1",
  startedAt: "07:14:32",
  duration: "00:42:18",
  prediction: "Drowsy",
  overallConfidence: 0.912,
};
export const decisionSummary = {
  status: "Drowsy",
  fatigueScore: 78,
  confidence: 91.2,
  ear: 0.19,
  mar: 0.62,
  headPose: { yaw: -14, pitch: 22, roll: 4 },
  inferenceMs: 27,
  risk: "High",
  gpu: "NVIDIA RTX A4000",
  gpuLoad: 63,
  model: "yolo-drowsy-v4.2.1",
};
export const earSeries = Array.from({ length: 60 }, (_, i) => {
  const t = i;
  const base = 0.3 + Math.sin(i / 6) * 0.05;
  const drop = i > 32 && i < 50 ? -0.12 : 0;
  const noise = (Math.random() - 0.5) * 0.02;
  return { t, ear: +(base + drop + noise).toFixed(3), threshold: 0.22 };
});
export const marSeries = Array.from({ length: 60 }, (_, i) => {
  const spike = [12, 28, 44].includes(i) ? 0.35 : 0;
  const base = 0.3 + Math.sin(i / 4) * 0.04;
  return { t: i, mar: +(base + spike + (Math.random() - 0.5) * 0.02).toFixed(3), threshold: 0.55 };
});
export const headPoseSeries = Array.from({ length: 60 }, (_, i) => ({
  t: i,
  yaw: +(Math.sin(i / 5) * 18).toFixed(1),
  pitch: +(10 + Math.cos(i / 7) * 14).toFixed(1),
  roll: +(Math.sin(i / 9) * 6).toFixed(1),
}));
export const temporalEvents = [
  { frame: 1, label: "Eyes Open", detail: "Baseline attention" },
  { frame: 35, label: "Eyes Closing", detail: "EAR trending downward" },
  { frame: 72, label: "EAR < threshold", detail: "EAR 0.19 (thr 0.22)" },
  { frame: 108, label: "Eyes closed > 1.2s", detail: "PERCLOS rising" },
  { frame: 140, label: "Fatigue Score ↑", detail: "Score 54 → 71" },
  { frame: 175, label: "Warning Triggered", detail: "Amber alert issued" },
  { frame: 220, label: "Sleep Detected", detail: "Red alert · buzzer" },
];
export const featureImportance = [
  { name: "Eyes (EAR)", value: 48, color: "hsl(180 78% 58%)" },
  { name: "Mouth (MAR)", value: 22, color: "hsl(45 90% 62%)" },
  { name: "Head Pose", value: 15, color: "hsl(280 70% 65%)" },
  { name: "Temporal", value: 10, color: "hsl(200 82% 60%)" },
  { name: "Detector Conf", value: 5, color: "hsl(0 78% 62%)" },
];
export const confidenceHistory = Array.from({ length: 40 }, (_, i) => ({
  t: i,
  conf: +(0.7 + Math.sin(i / 4) * 0.12 + (i > 25 ? 0.1 : 0)).toFixed(3),
}));
export const confidenceDistribution = [
  { bucket: "0.5-0.6", count: 4 },
  { bucket: "0.6-0.7", count: 11 },
  { bucket: "0.7-0.8", count: 22 },
  { bucket: "0.8-0.9", count: 38 },
  { bucket: "0.9-1.0", count: 61 },
];
export const modelMetrics = {
  precision: 0.942,
  recall: 0.918,
  f1: 0.93,
  map50: 0.951,
  map5095: 0.782,
  fps: 41,
  latency: 27,
  gpu: 63,
  cpu: 34,
  ram: 48,
  modelSize: "24.7 MB",
  version: "v4.2.1",
};
export const frames = Array.from({ length: 12 }, (_, i) => ({
  frame: 40 + i * 15,
  ts: `00:${String(20 + i).padStart(2, "0")}.${String((i * 83) % 1000).padStart(3, "0")}`,
  prediction: i < 4 ? "Alert" : i < 8 ? "Warning" : "Drowsy",
  confidence: +(0.72 + i * 0.02).toFixed(2),
  ear: +(0.3 - i * 0.012).toFixed(3),
  mar: +(0.32 + i * 0.03).toFixed(3),
  headPose: `Y ${(-5 + i).toFixed(0)}° P ${(10 + i).toFixed(0)}°`,
  risk: i < 4 ? "Low" : i < 8 ? "Medium" : "High",
}));
export const modelComparison = [
  {
    name: "YOLOv8-drowsy",
    active: true,
    precision: 0.942,
    recall: 0.918,
    f1: 0.93,
    map: 0.951,
    speed: "41 FPS",
    size: "24.7 MB",
    memory: "1.2 GB",
    status: "Deployed",
  },
  {
    name: "RF-DETR",
    active: false,
    precision: 0.951,
    recall: 0.905,
    f1: 0.928,
    map: 0.958,
    speed: "22 FPS",
    size: "88.4 MB",
    memory: "3.6 GB",
    status: "Staging",
  },
  {
    name: "Faster R-CNN",
    active: false,
    precision: 0.918,
    recall: 0.882,
    f1: 0.9,
    map: 0.921,
    speed: "9 FPS",
    size: "168 MB",
    memory: "5.1 GB",
    status: "Archived",
  },
];
export const recommendations = [
  {
    title: "Prolonged eye closure detected",
    detail:
      "Eyes were closed for 1.8s (threshold 1.2s). Recommend a 15-min break within 5 minutes.",
    severity: "high",
  },
  {
    title: "Yawning frequency ↑ 3.4x",
    detail: "MAR crossed threshold 3 times in the last 60s versus a baseline of 0.9.",
    severity: "medium",
  },
  {
    title: "Head pitch drift",
    detail: "Sustained downward pitch of 22° indicates gaze off-road. Consider posture reset.",
    severity: "medium",
  },
  {
    title: "Confidence stable",
    detail: "Model confidence held above 0.85 across the last 40 frames — decision is reliable.",
    severity: "low",
  },
];
export const pipelineStages = [
  "Camera",
  "Frame Capture",
  "Preprocess",
  "Object Detection",
  "Face Extraction",
  "EAR",
  "MAR",
  "Head Pose",
  "Temporal Analysis",
  "Decision Engine",
  "Alert Generation",
  "Database",
  "Dashboard",
];
