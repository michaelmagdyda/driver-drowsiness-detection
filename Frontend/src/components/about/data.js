export const problemStats = [
  { value: "20%", label: "of road accidents linked to driver fatigue", source: "WHO placeholder" },
  {
    value: "1 in 25",
    label: "drivers admit falling asleep at the wheel monthly",
    source: "CDC placeholder",
  },
  {
    value: "3s",
    label: "average micro-sleep at 100 km/h covers 83 meters",
    source: "NHTSA placeholder",
  },
  {
    value: "72%",
    label: "of fatigue events happen without prior awareness",
    source: "Internal research",
  },
];
export const workflowSteps = [
  { n: 1, title: "Capture Video", desc: "Cabin camera streams frames at 30 FPS.", icon: "Video" },
  {
    n: 2,
    title: "Detect Face",
    desc: "MediaPipe locates the driver's face landmarks.",
    icon: "ScanFace",
  },
  { n: 3, title: "Detect Eyes", desc: "Eye regions isolated with high accuracy.", icon: "Eye" },
  {
    n: 4,
    title: "Calculate EAR",
    desc: "Eye Aspect Ratio quantifies blink & closure.",
    icon: "Sigma",
  },
  { n: 5, title: "Detect Mouth", desc: "Mouth landmarks tracked for yawning cues.", icon: "Smile" },
  {
    n: 6,
    title: "Calculate MAR",
    desc: "Mouth Aspect Ratio identifies yawn events.",
    icon: "Sigma",
  },
  { n: 7, title: "Head Pose", desc: "Yaw, pitch, roll estimation via PnP.", icon: "Compass" },
  { n: 8, title: "Fatigue Score", desc: "Temporal fusion produces a 0-100 score.", icon: "Gauge" },
  {
    n: 9,
    title: "Trigger Alert",
    desc: "Multi-channel alarms fire above thresholds.",
    icon: "Bell",
  },
  {
    n: 10,
    title: "Generate Report",
    desc: "Session archived with charts & clips.",
    icon: "FileText",
  },
];
export const pipeline = [
  { title: "Input Stream", desc: "Raw RGB frames from WebRTC.", icon: "Radio" },
  { title: "Preprocessing", desc: "Resize, normalize, color-correct.", icon: "Sparkles" },
  { title: "Face Detection", desc: "YOLO-based detector locates driver.", icon: "ScanFace" },
  { title: "Feature Extraction", desc: "Landmarks, EAR, MAR, pose vectors.", icon: "Layers" },
  { title: "AI Model", desc: "Fine-tuned drowsiness classifier.", icon: "Cpu" },
  { title: "Temporal Analysis", desc: "PERCLOS, moving windows, FSM.", icon: "Waves" },
  { title: "Decision Engine", desc: "Rule + ML hybrid fatigue verdict.", icon: "Brain" },
  { title: "Alerts", desc: "Email, WhatsApp, dashboard, cabin alarm.", icon: "Bell" },
  { title: "Reports", desc: "Structured session archive.", icon: "FileText" },
];
export const architecture = [
  {
    tier: "Client",
    nodes: ["React + TypeScript", "TailwindCSS", "WebRTC Capture"],
    color: "primary",
  },
  { tier: "API", nodes: ["FastAPI", "WebSocket Gateway", "REST Endpoints"], color: "info" },
  {
    tier: "AI Engine",
    nodes: ["PyTorch", "OpenCV", "YOLO / RF-DETR / Faster R-CNN"],
    color: "warning",
  },
  {
    tier: "Data & Storage",
    nodes: ["Supabase Postgres", "Object Storage", "RLS Policies"],
    color: "success",
  },
  {
    tier: "Notifications",
    nodes: ["Email · SendGrid", "WhatsApp Business", "In-app Alerts"],
    color: "info",
  },
];
export const techStack = [
  { name: "React", desc: "UI framework", purpose: "Frontend", tag: "Frontend" },
  { name: "TypeScript", desc: "Typed JavaScript", purpose: "Safety", tag: "Frontend" },
  { name: "TailwindCSS", desc: "Utility CSS", purpose: "Design system", tag: "Frontend" },
  { name: "FastAPI", desc: "Python web framework", purpose: "API layer", tag: "Backend" },
  { name: "Python", desc: "Core language", purpose: "AI runtime", tag: "Backend" },
  { name: "PyTorch", desc: "Deep learning framework", purpose: "Model runtime", tag: "AI" },
  { name: "OpenCV", desc: "Computer vision", purpose: "Preprocessing", tag: "AI" },
  { name: "Ultralytics YOLO", desc: "Object detector", purpose: "Face & eye detection", tag: "AI" },
  { name: "RF-DETR", desc: "Transformer detector", purpose: "Robust detection", tag: "AI" },
  { name: "Faster R-CNN", desc: "Two-stage detector", purpose: "Benchmarking", tag: "AI" },
  { name: "Supabase", desc: "Backend-as-a-service", purpose: "Auth + DB + Storage", tag: "Data" },
  { name: "PostgreSQL", desc: "Relational DB", purpose: "Persistence", tag: "Data" },
  { name: "Docker", desc: "Containers", purpose: "Deployment", tag: "Infra" },
  { name: "WebSocket", desc: "Realtime protocol", purpose: "Streaming", tag: "Infra" },
  { name: "CUDA", desc: "GPU compute", purpose: "Inference", tag: "Infra" },
  { name: "GitHub", desc: "Version control", purpose: "Collaboration", tag: "Infra" },
];
export const models = [
  {
    name: "YOLOv8",
    purpose: "Real-time face & eye detection",
    advantages: ["Very fast inference", "Small footprint", "Edge-friendly"],
    limitations: ["Lower precision on occluded faces", "Sensitive to lighting"],
    metrics: { precision: 94.7, recall: 92.1, mAP50: 91.2, fps: 54 },
    future: "Distill to YOLO-nano for on-device use.",
    accent: "primary",
  },
  {
    name: "RF-DETR",
    purpose: "Transformer-based robust detection",
    advantages: ["Superior generalization", "No anchor tuning", "Strong on occlusions"],
    limitations: ["Higher VRAM usage", "Slower than YOLO"],
    metrics: { precision: 96.1, recall: 94.7, mAP50: 93.8, fps: 22 },
    future: "Explore knowledge distillation to YOLO backbone.",
    accent: "info",
  },
  {
    name: "Faster R-CNN",
    purpose: "Two-stage benchmark detector",
    advantages: ["High precision", "Mature ecosystem"],
    limitations: ["Slow inference", "Heavy compute"],
    metrics: { precision: 95.4, recall: 93.2, mAP50: 92.6, fps: 12 },
    future: "Used as an accuracy baseline for evaluation.",
    accent: "warning",
  },
];
export const features = [
  { name: "Live Monitoring", desc: "Real-time cabin HUD with fatigue gauge.", icon: "Radio" },
  { name: "Webcam Detection", desc: "Instant inference from any browser cam.", icon: "Camera" },
  { name: "Video Analysis", desc: "Batch drive footage with timeline results.", icon: "Video" },
  { name: "Image Analysis", desc: "Frame-level inspection & explainability.", icon: "Image" },
  { name: "Real-Time Alerts", desc: "Email, WhatsApp, and cockpit alarms.", icon: "Bell" },
  { name: "Analytics Dashboard", desc: "Fleet-wide KPIs and trend charts.", icon: "BarChart3" },
  { name: "Detection History", desc: "Full session archive with replay.", icon: "History" },
  { name: "Reports Center", desc: "Automated PDF/CSV/JSON exports.", icon: "FileText" },
  { name: "AI Explainability", desc: "Landmarks, decisions, confidence traces.", icon: "Brain" },
  { name: "Administrator Panel", desc: "Users, roles, models, and audit.", icon: "ShieldCheck" },
];
export const results = [
  { label: "Precision", value: 96.1, unit: "%" },
  { label: "Recall", value: 94.7, unit: "%" },
  { label: "F1 Score", value: 95.4, unit: "%" },
  { label: "mAP@0.50", value: 93.8, unit: "%" },
  { label: "mAP@0.50:0.95", value: 71.2, unit: "%" },
  { label: "FPS", value: 54, unit: "" },
  { label: "Inference", value: 18, unit: "ms" },
  { label: "GPU Usage", value: 68, unit: "%" },
];
export const perfSeries = Array.from({ length: 10 }, (_, i) => ({
  epoch: `E${i + 1}`,
  precision: +(0.72 + i * 0.026 + Math.random() * 0.01).toFixed(3),
  recall: +(0.68 + i * 0.028 + Math.random() * 0.01).toFixed(3),
  map: +(0.61 + i * 0.033 + Math.random() * 0.01).toFixed(3),
}));
export const timeline = [
  { phase: "Research", period: "Week 1-2", desc: "Literature review and problem framing." },
  {
    phase: "Dataset Collection",
    period: "Week 3-4",
    desc: "Gather cabin footage & public datasets.",
  },
  {
    phase: "Data Annotation",
    period: "Week 5-6",
    desc: "Label eyes, mouth, and drowsiness classes.",
  },
  { phase: "Model Training", period: "Week 7-9", desc: "Train YOLO, RF-DETR, and Faster R-CNN." },
  { phase: "Testing", period: "Week 10", desc: "Cross-validation and error analysis." },
  {
    phase: "Frontend Development",
    period: "Week 11-13",
    desc: "Cockpit UI, dashboards, monitoring.",
  },
  { phase: "Backend Development", period: "Week 12-14", desc: "FastAPI, WebSocket, storage." },
  { phase: "Deployment", period: "Week 15", desc: "Docker containers on Fly.io + RunPod GPU." },
  { phase: "Final Presentation", period: "Week 16", desc: "Live demo and thesis defense." },
];
export const team = [
  {
    name: "Ahmad Al-Rashid",
    role: "AI Lead & Team Coordinator",
    bio: "Fatigue modeling, temporal analysis, model training.",
    initials: "AR",
  },
  {
    name: "Sarah Mitchell",
    role: "Frontend Engineer",
    bio: "Cockpit UI, dashboards, and design system.",
    initials: "SM",
  },
  {
    name: "Kenji Tanaka",
    role: "Backend Engineer",
    bio: "FastAPI, WebSocket streaming, storage layer.",
    initials: "KT",
  },
  {
    name: "Elena Voss",
    role: "Data & Annotation Lead",
    bio: "Dataset curation, labeling quality, evaluation.",
    initials: "EV",
  },
  {
    name: "Dr. Layla Haddad",
    role: "Supervisor",
    bio: "Professor of Computer Vision · Faculty of Engineering.",
    initials: "LH",
  },
  {
    name: "Omar Khalil",
    role: "Teaching Assistant",
    bio: "Guidance on training pipelines and reproducibility.",
    initials: "OK",
  },
];
export const roadmap = [
  { title: "Mobile Application", desc: "Native iOS/Android with cabin cam access.", tag: "Q1" },
  { title: "Fleet Management", desc: "Multi-vehicle dashboards and driver ranking.", tag: "Q2" },
  { title: "Cloud AI Inference", desc: "Autoscaled GPU inference across regions.", tag: "Q2" },
  { title: "Multi-Camera Support", desc: "Fuse cabin + road-facing streams.", tag: "Q3" },
  { title: "Driver Identity", desc: "Optional face-ID for personalized baselines.", tag: "Q3" },
  { title: "AI Explainability", desc: "Grad-CAM overlays and decision traces.", tag: "Q3" },
  { title: "Voice Assistant", desc: "Conversational alerts and check-ins.", tag: "Q4" },
  { title: "Edge Deployment", desc: "Jetson & Coral for offline inference.", tag: "Q4" },
  { title: "IoT Integration", desc: "CAN bus signals fused with fatigue score.", tag: "Q4" },
];
export const acknowledgements = [
  { title: "Supervisor", body: "Dr. Layla Haddad — for guidance and unwavering support." },
  { title: "Department", body: "Department of Computer Engineering." },
  { title: "University", body: "Faculty of Engineering — Graduation Project Program." },
  { title: "Open-source", body: "PyTorch, Ultralytics, OpenCV, FastAPI, React, Supabase." },
  { title: "Research", body: "Soukupová & Čech (2016); Wang et al. (2020); RF-DETR (2024)." },
  { title: "Contributors", body: "Peer reviewers, testers, and volunteer drivers." },
];
