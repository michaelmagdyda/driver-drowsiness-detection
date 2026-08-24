import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  Cpu,
  Database,
  Download,
  Eye,
  FileText,
  Gauge,
  HardDrive,
  Info,
  Lightbulb,
  MemoryStick,
  Play,
  Radio,
  Server,
  ShieldCheck,
  TrendingUp,
  Upload,
  Video,
  Wifi,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});
/* -------------------------------------------------------------------------- */
/*  MOCK DATA — replace with FastAPI/Supabase feeds later                     */
/* -------------------------------------------------------------------------- */
const STATS = [
  { label: "Monitoring Sessions", value: 1284, suffix: "", trend: "+12.4%", icon: Radio },
  { label: "Today's Alerts", value: 37, suffix: "", trend: "-8.1%", icon: Bell },
  { label: "Videos Processed", value: 642, suffix: "", trend: "+4.2%", icon: Video },
  { label: "Images Processed", value: 3921, suffix: "", trend: "+18.7%", icon: Camera },
  { label: "Avg. Confidence", value: 97.2, suffix: "%", trend: "+0.4%", icon: ShieldCheck },
  { label: "Detection Accuracy", value: 98.6, suffix: "%", trend: "+1.1%", icon: TrendingUp },
  { label: "Average EAR", value: 0.28, suffix: "", trend: "stable", icon: Eye },
  { label: "Average MAR", value: 0.41, suffix: "", trend: "-0.02", icon: Activity },
  { label: "Avg Fatigue Score", value: 0.19, suffix: "", trend: "-5.6%", icon: Gauge },
];
const SYSTEM_STATUS = [
  {
    label: "System",
    status: "Operational",
    tone: "ok",
    icon: Server,
    desc: "All cockpit services online",
  },
  { label: "GPU", status: "RTX 4090 · 62°C", tone: "ok", icon: Cpu, desc: "Utilization 71%" },
  {
    label: "Model",
    status: "best.pt · v3.2",
    tone: "ok",
    icon: ShieldCheck,
    desc: "YOLO backend loaded",
  },
  {
    label: "Backend API",
    status: "FastAPI · 200 OK",
    tone: "ok",
    icon: Zap,
    desc: "Latency 42ms p95",
  },
  { label: "Database", status: "Healthy", tone: "ok", icon: Database, desc: "Connections 12 / 60" },
  {
    label: "Storage",
    status: "428 GB / 1 TB",
    tone: "warn",
    icon: HardDrive,
    desc: "43% used · rotate soon",
  },
  {
    label: "Camera",
    status: "1080p · 30fps",
    tone: "ok",
    icon: Camera,
    desc: "Front-facing feed steady",
  },
  {
    label: "WebSocket",
    status: "wss · stable",
    tone: "ok",
    icon: Wifi,
    desc: "0 dropped frames / 5m",
  },
];
const HEALTH = [
  { label: "CPU", value: 34, unit: "%", icon: Cpu },
  { label: "GPU", value: 71, unit: "%", icon: Zap },
  { label: "Memory", value: 58, unit: "%", icon: MemoryStick },
  { label: "Storage", value: 43, unit: "%", icon: HardDrive },
  { label: "Inference", value: 82, unit: "fps", icon: Gauge },
  { label: "FPS", value: 30, unit: "fps", icon: Activity },
  { label: "Latency", value: 42, unit: "ms", icon: TrendingUp },
  { label: "Network", value: 96, unit: "%", icon: Wifi },
];
const SESSIONS = [
  {
    driver: "Alex Morgan",
    date: "Jul 21, 09:14",
    duration: "42m",
    status: "Awake",
    alert: "None",
    confidence: 98.4,
  },
  {
    driver: "Sara Chen",
    date: "Jul 21, 08:02",
    duration: "1h 12m",
    status: "Drowsy",
    alert: "Yawning",
    confidence: 96.1,
  },
  {
    driver: "Ahmed Farouk",
    date: "Jul 20, 22:41",
    duration: "2h 08m",
    status: "Danger",
    alert: "Sleep Detected",
    confidence: 99.2,
  },
  {
    driver: "Lena Roth",
    date: "Jul 20, 18:22",
    duration: "36m",
    status: "Awake",
    alert: "None",
    confidence: 97.8,
  },
  {
    driver: "Marco Silva",
    date: "Jul 20, 14:05",
    duration: "58m",
    status: "Drowsy",
    alert: "Warning",
    confidence: 94.6,
  },
];
const ALERTS = [
  {
    title: "Sleep Detected",
    severity: "danger",
    driver: "Ahmed Farouk",
    when: "12 min ago",
    action: "Audio alarm + email",
  },
  { title: "Yawning", severity: "warn", driver: "Sara Chen", when: "38 min ago", action: "Logged" },
  {
    title: "Driver Warning",
    severity: "warn",
    driver: "Marco Silva",
    when: "1h ago",
    action: "Push notification",
  },
  {
    title: "System Safe",
    severity: "ok",
    driver: "Alex Morgan",
    when: "2h ago",
    action: "Cleared",
  },
];
const daily = Array.from({ length: 14 }, (_, i) => ({
  day: `D${i + 1}`,
  sessions: 40 + Math.round(Math.sin(i / 2) * 15 + Math.random() * 20),
}));
const trend = Array.from({ length: 24 }, (_, i) => ({
  t: `${i}:00`,
  ear: 0.28 + Math.sin(i / 3) * 0.04 + (Math.random() - 0.5) * 0.02,
  mar: 0.4 + Math.cos(i / 4) * 0.05 + (Math.random() - 0.5) * 0.02,
  fatigue: 0.2 + Math.sin(i / 5) * 0.12 + (Math.random() - 0.5) * 0.03,
  confidence: 95 + Math.sin(i / 6) * 3 + Math.random() * 2,
}));
const alertDist = [
  { name: "Safe", value: 62 },
  { name: "Warning", value: 21 },
  { name: "Yawning", value: 11 },
  { name: "Sleep", value: 6 },
];
const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-chart-2)",
  "var(--color-signal-drowsy)",
  "var(--color-signal-danger)",
];
const NOTIFICATIONS = [
  { title: "Weekly report ready", when: "10 min ago", icon: FileText },
  { title: "Driver Ahmed exceeded fatigue threshold", when: "1h ago", icon: AlertTriangle },
  { title: "Model best.pt updated to v3.2", when: "3h ago", icon: ShieldCheck },
  { title: "Scheduled maintenance · Jul 24 02:00 UTC", when: "yesterday", icon: Info },
];
const TIPS = [
  "Recalibrate the camera every 30 days for optimal EAR accuracy.",
  "Enable audio alerts for night driving sessions.",
  "Review weekly analytics to identify high-risk time windows.",
];
/* -------------------------------------------------------------------------- */
/*  PAGE                                                                       */
/* -------------------------------------------------------------------------- */
function DashboardPage() {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="p-6 lg:p-8 xl:p-10">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            Cockpit · Overview
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome back, Administrator
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {today} · System is healthy and ready for monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-signal-awake/40 bg-signal-awake/10 px-3.5 py-1.5 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-awake opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-awake" />
          </span>
          <span className="font-medium text-signal-awake">All systems nominal</span>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Main grid */}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* Statistics */}
          <StatsGrid />

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-3">
            <ChartCard title="Daily Sessions" subtitle="Last 14 days" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="gSess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    fill="url(#gSess)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Alert Distribution" subtitle="This week">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={alertDist}
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {alertDist.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "var(--color-foreground)" }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: "var(--color-muted-foreground)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="EAR / MAR Trend" subtitle="Last 24h" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="ear"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="mar"
                    stroke={CHART_COLORS[1]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="fatigue"
                    stroke={CHART_COLORS[2]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Confidence Trend" subtitle="Model output">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trend.slice(0, 12)}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={[80, 100]}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="confidence" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* System status */}
          <SystemStatusGrid />

          {/* Recent sessions table */}
          <RecentSessions />

          {/* Health + alerts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <SystemHealth />
            <RecentAlerts />
          </div>
        </div>

        {/* Right sidebar */}
        <RightSidebar />
      </div>

      <Footer />
    </div>
  );
}
/* -------------------------------------------------------------------------- */
/*  SECTIONS                                                                   */
/* -------------------------------------------------------------------------- */
const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-foreground)",
};
function QuickActions() {
  const actions = [
    { label: "Start Live Monitoring", icon: Play, primary: true, to: "/monitoring" },
    { label: "Upload Video", icon: Video, to: "/upload" },
    { label: "Upload Image", icon: Upload, to: "/upload" },
    { label: "View History", icon: Activity, to: "/history" },
    { label: "Analytics", icon: BarChart3, to: "/analytics" },
    { label: "Generate Report", icon: FileText, to: "/reports" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {actions.map((a, i) => (
        <motion.div
          key={a.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          whileHover={{ y: -2 }}
        >
          <Link
            to={a.to}
            className={`group flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all ${
              a.primary
                ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_30px_-8px_var(--color-primary)] hover:bg-primary/15"
                : "border-border/60 bg-card/60 text-foreground backdrop-blur hover:border-primary/30 hover:bg-card"
            }`}
          >
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${a.primary ? "bg-primary/20" : "bg-muted"}`}
            >
              <a.icon className="h-4 w-4" />
            </span>
            <span className="font-medium leading-tight">{a.label}</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
function StatsGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-3">
      {STATS.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          whileHover={{ y: -2 }}
        >
          <Card className="group relative overflow-hidden border-border/60 bg-card/60 backdrop-blur transition-colors hover:border-primary/30">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {s.label}
                </span>
                <s.icon className="h-4 w-4 text-primary/70" />
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <Counter to={s.value} decimals={s.value % 1 !== 0 ? 2 : 0} />
                {s.suffix && (
                  <span className="text-metric text-sm text-muted-foreground">{s.suffix}</span>
                )}
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                <span className="text-signal-awake">{s.trend}</span> vs last week
              </div>
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-70" />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
function Counter({ to, decimals = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const dur = 900;
    const start = performance.now();
    let raf = 0;
    const step = (t) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(to * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <span className="text-metric text-2xl font-semibold tracking-tight">{v.toFixed(decimals)}</span>
  );
}
function SystemStatusGrid() {
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 py-4">
        <div>
          <CardTitle className="text-sm font-medium">System status</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">All infrastructure signals</p>
        </div>
        <Badge
          variant="outline"
          className="border-signal-awake/40 bg-signal-awake/10 text-signal-awake"
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-signal-awake" /> Online
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {SYSTEM_STATUS.map((s) => {
          const tone =
            s.tone === "warn"
              ? "border-signal-drowsy/40 bg-signal-drowsy/5 text-signal-drowsy"
              : s.tone === "danger"
                ? "border-signal-danger/40 bg-signal-danger/5 text-signal-danger"
                : "border-signal-awake/30 bg-signal-awake/5 text-signal-awake";
          return (
            <div
              key={s.label}
              className="group rounded-xl border border-border/50 bg-background/40 p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex items-center justify-between">
                <s.icon className={`h-4 w-4 ${tone.split(" ").pop()}`} />
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${tone}`}
                >
                  {s.tone === "warn" ? "warn" : "ok"}
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold">{s.label}</div>
              <div className="text-metric mt-0.5 text-xs text-foreground/80">{s.status}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{s.desc}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
function RecentSessions() {
  const statusTone = (s) =>
    s === "Danger"
      ? "border-signal-danger/40 bg-signal-danger/10 text-signal-danger"
      : s === "Drowsy"
        ? "border-signal-drowsy/40 bg-signal-drowsy/10 text-signal-drowsy"
        : "border-signal-awake/40 bg-signal-awake/10 text-signal-awake";
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 py-4">
        <div>
          <CardTitle className="text-sm font-medium">Recent detection sessions</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Last 24 hours</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs">
          View all
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead>Driver</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Alert</TableHead>
              <TableHead className="text-right">Confidence</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SESSIONS.map((s) => (
              <TableRow key={s.driver} className="border-border/50 hover:bg-muted/40">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                        {s.driver
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    {s.driver}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{s.date}</TableCell>
                <TableCell className="text-metric">{s.duration}</TableCell>
                <TableCell>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${statusTone(s.status)}`}
                  >
                    {s.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{s.alert}</TableCell>
                <TableCell className="text-metric text-right">{s.confidence.toFixed(1)}%</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
function SystemHealth() {
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="border-b border-border/50 py-4">
        <CardTitle className="text-sm font-medium">Live system health</CardTitle>
        <p className="text-xs text-muted-foreground">Real-time infrastructure telemetry</p>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
        {HEALTH.map((h) => {
          const pct = Math.min(100, h.value);
          const isFps = h.unit === "fps";
          return (
            <div key={h.label} className="rounded-xl border border-border/50 bg-background/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <h.icon className="h-3.5 w-3.5" />
                  {h.label}
                </div>
                <div className="text-metric text-sm font-semibold">
                  {h.value}
                  <span className="ml-0.5 text-xs text-muted-foreground">{h.unit}</span>
                </div>
              </div>
              <Progress value={isFps ? Math.min(100, h.value) : pct} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
function RecentAlerts() {
  const tone = (sev) =>
    sev === "danger"
      ? {
          ring: "border-signal-danger/40 bg-signal-danger/10",
          text: "text-signal-danger",
          label: "Danger",
        }
      : sev === "warn"
        ? {
            ring: "border-signal-drowsy/40 bg-signal-drowsy/10",
            text: "text-signal-drowsy",
            label: "Warning",
          }
        : {
            ring: "border-signal-awake/40 bg-signal-awake/10",
            text: "text-signal-awake",
            label: "Safe",
          };
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 py-4">
        <div>
          <CardTitle className="text-sm font-medium">Recent alerts</CardTitle>
          <p className="text-xs text-muted-foreground">Triage log</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs">
          All alerts
        </Button>
      </CardHeader>
      <CardContent className="space-y-2.5 p-5">
        {ALERTS.map((a) => {
          const t = tone(a.severity);
          return (
            <motion.div
              key={a.title + a.when}
              whileHover={{ x: 2 }}
              className={`flex items-start gap-3 rounded-xl border p-3.5 ${t.ring} ${a.severity === "danger" ? "pulse-danger" : ""}`}
            >
              <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${t.text}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{a.title}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${t.ring} ${t.text}`}
                  >
                    {t.label}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {a.driver} · {a.when} · Action: {a.action}
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <Card className={`border-border/60 bg-card/60 backdrop-blur ${className}`}>
      <CardHeader className="border-b border-border/50 py-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}
function RightSidebar() {
  return (
    <aside className="space-y-6">
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="border-b border-border/50 py-4">
          <CardTitle className="text-sm font-medium">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {NOTIFICATIONS.map((n) => (
            <div
              key={n.title}
              className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/40"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <n.icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium leading-snug">{n.title}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{n.when}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="border-b border-border/50 py-4">
          <CardTitle className="text-sm font-medium">Latest reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {["Weekly Fatigue Summary", "Fleet Safety · July", "Model Accuracy · v3.2"].map((r) => (
            <button
              key={r}
              className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3 text-left text-xs transition-colors hover:border-primary/30"
            >
              <span className="font-medium">{r}</span>
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="border-b border-border/50 py-4">
          <CardTitle className="text-sm font-medium">Upcoming maintenance</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="rounded-lg border border-signal-drowsy/30 bg-signal-drowsy/5 p-3">
            <div className="text-xs font-semibold text-signal-drowsy">Model retraining</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Scheduled for Jul 24, 02:00 UTC · expected downtime 15 min
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="border-b border-border/50 py-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-primary" />
            Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 p-4">
          {TIPS.map((t) => (
            <div key={t} className="flex gap-2 text-xs text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
              <span>{t}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
function Footer() {
  return (
    <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-6 text-xs text-muted-foreground">
      <div>© {new Date().getFullYear()} DriveAlert · AI Safety Systems</div>
      <div className="flex items-center gap-4">
        <span>v3.2.1</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-awake" />
          All systems nominal
        </span>
      </div>
    </footer>
  );
}
