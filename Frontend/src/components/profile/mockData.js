export const profile = {
  fullName: "Ahmad Al-Rashid",
  initials: "AR",
  role: "Administrator",
  organization: "DriveAlert AI Labs",
  email: "ahmad@drivealert.ai",
  phone: "+971 50 218 4472",
  department: "Safety Engineering",
  jobTitle: "Principal AI Engineer",
  bio: "Building fatigue-detection systems for commercial fleets. Coffee-driven, latency-obsessed.",
  country: "United Arab Emirates",
  timezone: "GMT+4 · Gulf Standard Time",
  language: "English",
  joinedAt: "March 14, 2024",
  lastLogin: "2 minutes ago",
  status: "active",
};
export const overviewStats = [
  { label: "Monitoring Sessions", value: 1284, unit: "", icon: "Radio", accent: "primary" },
  { label: "Reports Generated", value: 342, unit: "", icon: "FileText", accent: "info" },
  { label: "Alerts Reviewed", value: 918, unit: "", icon: "Bell", accent: "warning" },
  { label: "Videos Uploaded", value: 214, unit: "", icon: "Video", accent: "primary" },
  { label: "Images Analyzed", value: 587, unit: "", icon: "Image", accent: "info" },
  { label: "Avg. Fatigue Score", value: 28, unit: "%", icon: "Activity", accent: "success" },
  { label: "Storage Used", value: 412, unit: "GB", icon: "HardDrive", accent: "warning" },
  { label: "Account Age", value: 16, unit: "mo", icon: "Calendar", accent: "muted" },
];
export const monthlySessions = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
  sessions: Math.round(60 + Math.sin(i / 2) * 30 + Math.random() * 20),
  reports: Math.round(20 + Math.cos(i / 3) * 10 + Math.random() * 8),
}));
export const weeklyActivity = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({
  day: d,
  logins: Math.round(4 + Math.sin(i) * 2 + Math.random() * 2),
  uploads: Math.round(2 + Math.cos(i) * 1.5 + Math.random() * 2),
}));
export const activityFeed = [
  {
    id: "a1",
    ts: "2 min ago",
    icon: "LogIn",
    title: "Signed in from Chrome · Dubai",
    status: "success",
  },
  {
    id: "a2",
    ts: "38 min ago",
    icon: "Radio",
    title: "Started live monitoring session s_9241",
    status: "info",
  },
  {
    id: "a3",
    ts: "1 hr ago",
    icon: "Video",
    title: "Uploaded video cabin_night_04.mp4",
    status: "info",
  },
  {
    id: "a4",
    ts: "2 hr ago",
    icon: "FileText",
    title: "Generated report · Fleet Weekly Summary",
    status: "success",
  },
  {
    id: "a5",
    ts: "4 hr ago",
    icon: "Download",
    title: "Exported PDF · Session s_9187",
    status: "success",
  },
  {
    id: "a6",
    ts: "Yesterday",
    icon: "Settings",
    title: "Updated fatigue thresholds (EAR 0.22)",
    status: "info",
  },
  {
    id: "a7",
    ts: "Yesterday",
    icon: "Bell",
    title: "Acknowledged critical alert alt_2841",
    status: "warning",
  },
  {
    id: "a8",
    ts: "2 days ago",
    icon: "Image",
    title: "Analyzed 12 images in batch",
    status: "info",
  },
];
export const sessionsList = [
  {
    device: "MacBook Pro · Chrome 128",
    location: "Dubai, AE",
    ip: "10.0.14.22",
    lastActive: "Active now",
    current: true,
  },
  {
    device: "iPhone 15 · Safari",
    location: "Dubai, AE",
    ip: "94.203.11.4",
    lastActive: "1 hr ago",
    current: false,
  },
  {
    device: "iPad Pro · Safari",
    location: "Abu Dhabi, AE",
    ip: "94.203.44.9",
    lastActive: "3 days ago",
    current: false,
  },
  {
    device: "Windows 11 · Edge",
    location: "Riyadh, SA",
    ip: "88.12.44.201",
    lastActive: "9 days ago",
    current: false,
  },
];
export const loginHistory = [
  { ts: "2026-07-22 09:42", ip: "10.0.14.22", location: "Dubai, AE", result: "success" },
  { ts: "2026-07-22 07:18", ip: "10.0.14.22", location: "Dubai, AE", result: "success" },
  { ts: "2026-07-21 22:04", ip: "94.203.11.4", location: "Dubai, AE", result: "success" },
  { ts: "2026-07-21 08:11", ip: "203.0.113.44", location: "Unknown", result: "failed" },
  { ts: "2026-07-20 09:02", ip: "10.0.14.22", location: "Dubai, AE", result: "success" },
];
export const securityRecommendations = [
  { title: "Enable two-factor authentication", severity: "high", action: "Set up" },
  { title: "Review 4 active sessions", severity: "medium", action: "Review" },
  { title: "Update password (last changed 94 days ago)", severity: "medium", action: "Change" },
  { title: "Verify recovery email", severity: "low", action: "Verify" },
];
export const connectedServices = [
  { name: "Lovable Cloud", desc: "Database, auth, storage", status: "connected", sync: "just now" },
  { name: "Google Drive", desc: "Export reports and archives", status: "disconnected", sync: "—" },
  {
    name: "Email Provider (SendGrid)",
    desc: "Transactional alerts",
    status: "connected",
    sync: "4 min ago",
  },
  {
    name: "WhatsApp Business API",
    desc: "Critical alert delivery",
    status: "connected",
    sync: "12 min ago",
  },
  { name: "FastAPI Inference", desc: "Fatigue AI backend", status: "connected", sync: "live" },
  {
    name: "Cloud Storage (S3)",
    desc: "Long-term session archive",
    status: "disconnected",
    sync: "—",
  },
];
export const achievements = [
  {
    name: "First Session",
    desc: "Ran your first monitoring session",
    icon: "Sparkles",
    unlocked: true,
  },
  { name: "Century Club", desc: "Completed 100 sessions", icon: "Trophy", unlocked: true },
  { name: "Report Master", desc: "Generated 100 reports", icon: "FileText", unlocked: true },
  { name: "AI Explorer", desc: "Tried all detection modes", icon: "Cpu", unlocked: true },
  {
    name: "Safety Champion",
    desc: "Maintained fleet score > 90 for 30 days",
    icon: "ShieldCheck",
    unlocked: false,
  },
  { name: "Night Owl", desc: "Reviewed 50 night-shift alerts", icon: "Moon", unlocked: false },
];
export const storageBreakdown = [
  { label: "Videos", value: 268, unit: "GB", color: "hsl(180 65% 55%)" },
  { label: "Images", value: 64, unit: "GB", color: "hsl(200 70% 60%)" },
  { label: "Reports", value: 22, unit: "GB", color: "hsl(160 60% 55%)" },
  { label: "Temporary Files", value: 58, unit: "GB", color: "hsl(45 85% 60%)" },
];
export const securityScore = 72;
