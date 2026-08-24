import {
  Lock,
  ShieldAlert,
  Compass,
  ServerCrash,
  Wrench,
  WifiOff,
  Cloud,
  Database,
  Cpu,
  Brain,
  VideoOff,
  Camera,
  HardDrive,
  Clock,
  UploadCloud,
  FileWarning,
  BellOff,
  Bot,
} from "lucide-react";
export const ERROR_PAGES = {
  401: {
    slug: "401",
    code: "401",
    title: "Authentication required",
    eyebrow: "Error · 401",
    description:
      "This area is reserved for signed-in operators. Sign in to continue your DriveAlert session.",
    icon: Lock,
    tone: "info",
    actions: [
      { label: "Sign in", variant: "primary", to: "/auth" },
      { label: "Go home", variant: "secondary", to: "/" },
      { label: "Contact administrator", variant: "ghost", href: "mailto:admin@drivealert.io" },
    ],
    tips: [
      "Sessions expire after long inactivity for safety.",
      "Use single sign-on if your fleet enabled it.",
      "Check your invite email if you haven't set a password.",
    ],
  },
  403: {
    slug: "403",
    code: "403",
    title: "Access denied",
    eyebrow: "Error · 403",
    description: "You're signed in, but this workspace or action is outside your permission scope.",
    icon: ShieldAlert,
    tone: "danger",
    actions: [
      { label: "Return to dashboard", variant: "primary", to: "/dashboard" },
      { label: "Request access", variant: "secondary", onClick: "noop" },
    ],
    tips: [
      "Ask an administrator to grant the required role.",
      "Roles are refreshed on next sign-in.",
    ],
  },
  404: {
    slug: "404",
    code: "404",
    title: "You've drifted off route",
    eyebrow: "Error · 404",
    description: "The page you're looking for doesn't exist, moved, or the link is misspelled.",
    icon: Compass,
    tone: "primary",
    actions: [
      { label: "Return home", variant: "primary", to: "/" },
      { label: "Search", variant: "secondary", onClick: "noop" },
    ],
    tips: ["Double-check the URL for typos.", "Use the sidebar to reach a known section."],
    extras: [
      {
        kind: "links",
        items: [
          { label: "Dashboard", to: "/dashboard" },
          { label: "Live Monitoring", to: "/monitoring" },
          { label: "Reports", to: "/reports" },
          { label: "Settings", to: "/settings" },
        ],
      },
    ],
  },
  500: {
    slug: "500",
    code: "500",
    title: "Something went sideways",
    eyebrow: "Error · 500",
    description:
      "Our backend hit an unexpected condition. The incident has been logged and engineers were notified.",
    icon: ServerCrash,
    tone: "danger",
    actions: [
      { label: "Try again", variant: "primary", onClick: "reload" },
      { label: "Dashboard", variant: "secondary", to: "/dashboard" },
    ],
    tips: [
      "Retry after a few seconds — most errors self-heal.",
      "Technical details will appear here soon.",
    ],
    extras: [
      {
        kind: "meta",
        items: [
          { label: "Incident ID", value: "INC-8842-A9F1" },
          { label: "Reported", value: "just now" },
          { label: "Severity", value: "S3" },
          { label: "Details", value: "Coming soon" },
        ],
      },
    ],
  },
  503: {
    slug: "503",
    code: "503",
    title: "Scheduled maintenance",
    eyebrow: "System · 503",
    description: "DriveAlert is undergoing planned improvements. We'll be back online shortly.",
    icon: Wrench,
    tone: "warning",
    actions: [
      { label: "Refresh", variant: "primary", onClick: "reload" },
      { label: "Status page", variant: "secondary", onClick: "noop" },
    ],
    tips: [
      "Maintenance windows are announced 48h in advance.",
      "Live monitoring resumes automatically when service is back.",
    ],
    extras: [
      { kind: "progress", label: "Deployment progress", value: 72, hint: "ETA: ~14 minutes" },
      {
        kind: "meta",
        items: [
          { label: "Window", value: "02:00 – 02:30 UTC" },
          { label: "Region", value: "eu-west" },
          { label: "Component", value: "Inference workers" },
        ],
      },
    ],
  },
  offline: {
    slug: "offline",
    code: "OFFLINE",
    title: "You're offline",
    eyebrow: "Network · Disconnected",
    description:
      "We can't reach the internet from this device. Reconnect to resume live monitoring.",
    icon: WifiOff,
    tone: "warning",
    actions: [
      { label: "Retry connection", variant: "primary", onClick: "reload" },
      { label: "Continue offline", variant: "secondary", onClick: "noop" },
    ],
    tips: ["Check Wi-Fi or cellular signal.", "Disable VPN if it recently reconnected."],
    extras: [
      {
        kind: "status",
        items: [
          { label: "Local network", value: "Weak", state: "warn" },
          { label: "Gateway", value: "Unreachable", state: "down" },
          { label: "DriveAlert API", value: "Waiting", state: "warn" },
        ],
      },
    ],
  },
  "backend-unavailable": {
    slug: "backend-unavailable",
    code: "API·502",
    title: "Backend unavailable",
    eyebrow: "Service · FastAPI",
    description:
      "The inference API isn't responding. We're retrying automatically in the background.",
    icon: Cloud,
    tone: "danger",
    actions: [
      { label: "Retry", variant: "primary", onClick: "reload" },
      { label: "View system status", variant: "secondary", onClick: "noop" },
    ],
    tips: [
      "The client keeps a rolling buffer for the last 30 seconds.",
      "Sessions resume automatically once the API is healthy.",
    ],
    extras: [
      {
        kind: "status",
        items: [
          { label: "Backend", value: "Offline", state: "down" },
          { label: "Websocket", value: "Reconnecting", state: "warn" },
          { label: "Health probe", value: "3 / 5", state: "warn" },
        ],
      },
      {
        kind: "meta",
        items: [
          { label: "Retry attempt", value: "#4" },
          { label: "Next retry", value: "in 6s" },
        ],
      },
    ],
  },
  "database-down": {
    slug: "database-down",
    code: "DB·CONN",
    title: "Database connection lost",
    eyebrow: "Service · Postgres",
    description:
      "We can't reach the primary database right now. Your recent changes are safely queued.",
    icon: Database,
    tone: "danger",
    actions: [
      { label: "Retry", variant: "primary", onClick: "reload" },
      { label: "Contact administrator", variant: "secondary", href: "mailto:admin@drivealert.io" },
    ],
    tips: [
      "Uploads and reports will retry automatically.",
      "Read-only mode may activate for critical views.",
    ],
    extras: [
      {
        kind: "status",
        items: [
          { label: "Primary DB", value: "Offline", state: "down" },
          { label: "Replica", value: "Healthy", state: "ok" },
          { label: "Failover", value: "In progress", state: "maint" },
        ],
      },
    ],
  },
  "model-loading": {
    slug: "model-loading",
    code: "AI·INIT",
    title: "Warming up the AI model",
    eyebrow: "Inference · Loading",
    description:
      "The detection model is initializing weights and warming CUDA kernels. This usually takes a few seconds.",
    icon: Cpu,
    tone: "primary",
    actions: [
      { label: "Continue waiting", variant: "primary", onClick: "noop" },
      { label: "Return to dashboard", variant: "secondary", to: "/dashboard" },
    ],
    extras: [
      {
        kind: "progress",
        label: "Model warm-up",
        value: 64,
        hint: "Estimated: 8 seconds remaining",
      },
      {
        kind: "meta",
        items: [
          { label: "Model", value: "DriveAlert-YOLOv8n" },
          { label: "Version", value: "v2.4.1" },
          { label: "GPU", value: "RTX A4000 · idle" },
          { label: "Precision", value: "FP16" },
        ],
      },
    ],
    tips: ["First load per session is slowest.", "Subsequent starts are cached and near-instant."],
  },
  "model-failed": {
    slug: "model-failed",
    code: "AI·FAIL",
    title: "AI inference failed",
    eyebrow: "Inference · Error",
    description: "The model crashed during inference. Your session is safe — no data was lost.",
    icon: Brain,
    tone: "danger",
    actions: [
      { label: "Restart model", variant: "primary", onClick: "noop" },
      { label: "Return to dashboard", variant: "secondary", to: "/dashboard" },
    ],
    extras: [
      {
        kind: "meta",
        items: [
          { label: "Model", value: "DriveAlert-YOLOv8n" },
          { label: "Version", value: "v2.4.1" },
          { label: "Last successful run", value: "2 min ago" },
          { label: "Error class", value: "RuntimeError" },
        ],
      },
    ],
    tips: [
      "Restarting the worker resolves most transient errors.",
      "Persistent failures trigger automatic rollback to v2.4.0.",
    ],
  },
  "camera-permission": {
    slug: "camera-permission",
    code: "CAM·PERM",
    title: "Camera access blocked",
    eyebrow: "Device · Permission",
    description: "Your browser blocked camera access. Enable it to start live driver monitoring.",
    icon: VideoOff,
    tone: "warning",
    actions: [
      { label: "Retry camera", variant: "primary", onClick: "reload" },
      {
        label: "Open browser help",
        variant: "secondary",
        href: "https://support.google.com/chrome/answer/2693767",
      },
    ],
    tips: [
      "Click the lock icon in the address bar → Site settings → Camera → Allow.",
      "Reload the page after granting permission.",
      "Some corporate policies disable camera access globally.",
    ],
  },
  "camera-missing": {
    slug: "camera-missing",
    code: "CAM·NONE",
    title: "No camera detected",
    eyebrow: "Device · Missing",
    description: "We couldn't find a connected webcam or DMS camera on this device.",
    icon: Camera,
    tone: "warning",
    actions: [
      { label: "Refresh devices", variant: "primary", onClick: "reload" },
      { label: "Upload video instead", variant: "secondary", to: "/upload" },
    ],
    tips: ["Reconnect USB cameras and refresh.", "Bluetooth cameras must be paired first."],
  },
  "storage-full": {
    slug: "storage-full",
    code: "DISK·FULL",
    title: "Storage limit reached",
    eyebrow: "Account · Storage",
    description:
      "You've used all available storage. Free up space or upgrade your plan to keep recording.",
    icon: HardDrive,
    tone: "warning",
    actions: [
      { label: "Clean storage", variant: "primary", to: "/settings" },
      { label: "Upgrade storage", variant: "secondary", onClick: "noop" },
    ],
    extras: [
      { kind: "progress", label: "Storage used", value: 98, hint: "49 GB of 50 GB" },
      {
        kind: "meta",
        items: [
          { label: "Session clips", value: "31.2 GB" },
          { label: "Uploaded videos", value: "12.6 GB" },
          { label: "Reports", value: "3.1 GB" },
          { label: "Other", value: "2.1 GB" },
        ],
      },
    ],
    tips: [
      "Session clips older than 90 days can be archived.",
      "PDF reports are lightweight and safe to keep.",
    ],
  },
  "session-expired": {
    slug: "session-expired",
    code: "SESSION·EXP",
    title: "Your session expired",
    eyebrow: "Session · Timed out",
    description: "For your safety, we ended your session after a period of inactivity.",
    icon: Clock,
    tone: "warning",
    actions: [
      { label: "Sign in again", variant: "primary", to: "/auth" },
      { label: "Return home", variant: "secondary", to: "/" },
    ],
    tips: [
      "Sessions expire after 30 minutes of inactivity.",
      "Enable 'Remember this device' for longer sessions.",
    ],
  },
  "upload-failed": {
    slug: "upload-failed",
    code: "UPLOAD·FAIL",
    title: "Upload didn't complete",
    eyebrow: "File · Upload",
    description: "Your file couldn't be uploaded. See possible causes below and try again.",
    icon: UploadCloud,
    tone: "danger",
    actions: [
      { label: "Retry upload", variant: "primary", onClick: "reload" },
      { label: "Choose another file", variant: "secondary", to: "/upload" },
    ],
    extras: [
      {
        kind: "reasons",
        items: [
          "File exceeds the 500 MB per-file limit",
          "Format not supported (.mp4, .mov, .avi, .jpg, .png only)",
          "Network was interrupted during transfer",
          "Storage quota reached on your account",
        ],
      },
    ],
  },
  "report-failed": {
    slug: "report-failed",
    code: "RPT·FAIL",
    title: "Report generation failed",
    eyebrow: "Reports · Error",
    description:
      "We couldn't finish building your report. Your session data is intact — you can retry safely.",
    icon: FileWarning,
    tone: "danger",
    actions: [
      { label: "Retry", variant: "primary", onClick: "reload" },
      { label: "Return to reports", variant: "secondary", to: "/reports" },
    ],
    tips: [
      "Large date ranges may take longer to compile.",
      "Try exporting a narrower window as a workaround.",
    ],
  },
  "notification-failed": {
    slug: "notification-failed",
    code: "NOTIFY·FAIL",
    title: "Notification delivery failed",
    eyebrow: "Alerts · Delivery",
    description:
      "One or more notification channels couldn't deliver this alert. The alert is still recorded.",
    icon: BellOff,
    tone: "warning",
    actions: [
      { label: "Retry notification", variant: "primary", onClick: "noop" },
      { label: "View alert", variant: "secondary", to: "/alerts" },
    ],
    extras: [
      {
        kind: "status",
        items: [
          { label: "Email", value: "Delivered", state: "ok" },
          { label: "WhatsApp", value: "Failed · 3 retries", state: "down" },
          { label: "In-app", value: "Delivered", state: "ok" },
        ],
      },
    ],
    tips: [
      "Verify recipient numbers in Settings → Notifications.",
      "WhatsApp business templates must be pre-approved.",
    ],
  },
  unknown: {
    slug: "unknown",
    code: "ERR·???",
    title: "Something unexpected happened",
    eyebrow: "Unknown · Error",
    description: "Our systems ran into a case we didn't recognize. It's already on our radar.",
    icon: Bot,
    tone: "info",
    actions: [
      { label: "Go home", variant: "primary", to: "/" },
      { label: "Contact support", variant: "secondary", href: "mailto:support@drivealert.io" },
    ],
    tips: ["Refreshing usually helps.", "If it keeps happening, share the error ID with support."],
  },
};
export const ERROR_LIST = Object.values(ERROR_PAGES);
