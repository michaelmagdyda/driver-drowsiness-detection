import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Search,
  Bell,
  ChevronRight,
  Users,
  UserCheck,
  Radio,
  Video,
  Cpu,
  FileText,
  AlertTriangle,
  Activity,
  Server,
  HardDrive,
  ClipboardList,
  Terminal,
  Lock,
  Wrench,
  UsersRound,
  KeySquare,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { listAdminUsers, listModelCheckpoints, activateModelCheckpoint, ApiError } from "@/lib/api";
import { AdminOverviewCard } from "@/components/admin/AdminOverviewCard";
import { HealthStatusCard, ResourceGauge } from "@/components/admin/HealthStatusCard";
import { UserTable } from "@/components/admin/UserTable";
import { RoleCard } from "@/components/admin/RoleCard";
import { SessionCard } from "@/components/admin/SessionCard";
import { ModelCard } from "@/components/admin/ModelCard";
import { StoragePanel } from "@/components/admin/StorageCard";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { SystemLogViewer } from "@/components/admin/SystemLogViewer";
import { SecurityCard } from "@/components/admin/SecurityCard";
import { QuickActionPanel } from "@/components/admin/QuickActionPanel";
import {
  overviewKPIs,
  healthServices,
  resourceMetrics,
  activeSessions,
  securityKPIs,
  alertTrend,
  devEndpoints,
} from "@/components/admin/mockData";
const iconMap = {
  Users,
  UserCheck,
  Radio,
  Video,
  Cpu,
  FileText,
  AlertTriangle,
  Activity,
};
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administrator Panel — DriveAlert" },
      {
        name: "description",
        content:
          "Command center for the DriveAlert AI Driver Monitoring platform: system health, user management, AI models, sessions and audit logs.",
      },
      { property: "og:title", content: "Administrator Panel — DriveAlert" },
      {
        property: "og:description",
        content: "Operational command center for the DriveAlert platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPanel,
});
const ROLE_META = {
  admin: {
    label: "Administrator",
    color: "danger",
    level: "Full access",
    description: "Full system access: users, roles, models and settings.",
  },
  user: {
    label: "User",
    color: "primary",
    level: "Standard",
    description: "Runs monitoring sessions and views their own history.",
  },
};

function AdminPanel() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState("loading"); // loading | done | error
  const [usersError, setUsersError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    listAdminUsers()
      .then((data) => {
        if (cancelled) return;
        setUsers(data);
        setUsersStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setUsersError(err instanceof ApiError ? err.message : "Failed to load users.");
        setUsersStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [checkpoints, setCheckpoints] = useState([]);
  const [checkpointsStatus, setCheckpointsStatus] = useState("loading"); // loading | done | error
  const [checkpointsError, setCheckpointsError] = useState(null);
  const [checkpointsRefreshTick, setCheckpointsRefreshTick] = useState(0);
  const [activatingId, setActivatingId] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setCheckpointsStatus("loading");
    listModelCheckpoints()
      .then((data) => {
        if (cancelled) return;
        setCheckpoints(data);
        setCheckpointsStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setCheckpointsError(
          err instanceof ApiError ? err.message : "Failed to load model checkpoints.",
        );
        setCheckpointsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [checkpointsRefreshTick]);

  async function handleActivate(id) {
    setActivatingId(id);
    try {
      const data = await activateModelCheckpoint(id);
      setCheckpoints(data);
      toast.success("Active model switched.", { description: id });
    } catch (err) {
      toast.error("Could not switch the active model", {
        description: err instanceof ApiError ? err.message : "Unexpected error.",
      });
    } finally {
      setActivatingId(null);
    }
  }

  const realRoles = ["admin", "user"].map((key) => ({
    name: ROLE_META[key].label,
    count: users.filter((u) => u.role === key).length,
    color: ROLE_META[key].color,
    level: ROLE_META[key].level,
    description: ROLE_META[key].description,
  }));

  return (
    <div className="min-h-full bg-cockpit">
      {/* Sub-header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_30px_-8px_var(--color-primary)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>DriveAlert</span>
                <ChevronRight className="h-3 w-3" />
                <span>System</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">Administrator</span>
              </div>
              <h1 className="font-display text-xl font-semibold tracking-tight">
                Administrator Panel
              </h1>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users, sessions, models, logs…"
                className="h-9 w-80 border-border/60 bg-card/60 pl-8 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="h-9 border-border/60">
              <Bell className="mr-1.5 h-3.5 w-3.5" />
              <span className="text-xs">4 new</span>
            </Button>
            <div className="hidden rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-metric text-xs text-muted-foreground md:block">
              {time.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
              <span className="text-xs">Ahmad · Root Admin</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-10 px-6 py-8">
        {/* Administrator Overview */}
        <Section
          eyebrow="Overview"
          title="Platform pulse"
          description="A live snapshot of what's happening across every DriveAlert deployment."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {overviewKPIs.map((k, i) => (
              <AdminOverviewCard
                key={k.label}
                label={k.label}
                value={k.value}
                delta={k.delta}
                trend={k.trend}
                Icon={iconMap[k.icon]}
                index={i}
              />
            ))}
          </div>
        </Section>

        <QuickActionPanel />

        {/* System Health */}
        <Section
          eyebrow="Infrastructure"
          title="System Health"
          description="Real-time state of every service, gateway and worker."
          icon={Server}
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {healthServices.map((s) => (
              <HealthStatusCard key={s.name} {...s} />
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {resourceMetrics.map((m) => (
              <ResourceGauge key={m.name} {...m} />
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">24h Alerts & Auth Activity</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                rolling window
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={alertTrend}>
                <defs>
                  <linearGradient id="alertsG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(45 85% 60%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(45 85% 60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="loginsG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
                <XAxis dataKey="hour" stroke="hsl(0 0% 100% / 0.4)" fontSize={10} />
                <YAxis stroke="hsl(0 0% 100% / 0.4)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(11,15,20,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="alerts"
                  stroke="hsl(45 85% 60%)"
                  strokeWidth={2}
                  fill="url(#alertsG)"
                />
                <Area
                  type="monotone"
                  dataKey="logins"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#loginsG)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* User Management */}
        <Section
          eyebrow="People"
          title="User Management"
          description="Every registered account and its effective role."
          icon={UsersRound}
        >
          {usersStatus === "loading" ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/40 p-10 text-sm text-muted-foreground">
              Loading users…
            </div>
          ) : usersStatus === "error" ? (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {usersError}
            </div>
          ) : (
            <UserTable users={users} />
          )}
        </Section>

        {/* Role Management */}
        <Section
          eyebrow="Access"
          title="Role Management"
          description="The two roles the database defines, and how many users hold each."
          icon={KeySquare}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {realRoles.map((r) => (
              <RoleCard key={r.name} {...r} />
            ))}
          </div>
        </Section>

        {/* AI Model Management */}
        <Section
          eyebrow="Intelligence"
          title="AI Model Management"
          description="Real checkpoints on disk, each verified by an actual load attempt against the current architecture."
          icon={Cpu}
        >
          <div className="mb-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setCheckpointsRefreshTick((t) => t + 1)}
              disabled={checkpointsStatus === "loading"}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
          {checkpointsStatus === "loading" ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/40 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading checkpoints — each one is
              actually load-tested, this can take a moment…
            </div>
          ) : checkpointsStatus === "error" ? (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {checkpointsError}
            </div>
          ) : checkpoints.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
              No checkpoint files found in the configured checkpoints directory.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {checkpoints.map((c) => (
                <ModelCard
                  key={c.id}
                  checkpoint={c}
                  activating={activatingId === c.id}
                  onActivate={() => handleActivate(c.id)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Active Sessions */}
        <Section
          eyebrow="Live"
          title="Active Monitoring Sessions"
          description="Every driver currently under AI observation."
          icon={Radio}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeSessions.map((s) => (
              <SessionCard key={s.id} {...s} />
            ))}
          </div>
        </Section>

        {/* Storage */}
        <Section
          eyebrow="Data"
          title="Storage Management"
          description="Buckets, backups and retention across the fleet."
          icon={HardDrive}
        >
          <StoragePanel />
        </Section>

        {/* Audit Logs */}
        <Section
          eyebrow="Compliance"
          title="Audit Logs"
          description="Every administrative action, signed and searchable."
          icon={ClipboardList}
        >
          <AuditLogTable />
        </Section>

        {/* System Logs */}
        <Section
          eyebrow="Observability"
          title="System Logs"
          description="Structured log stream from backend, AI, API, auth and notifications."
          icon={Terminal}
        >
          <SystemLogViewer />
        </Section>

        {/* Security Dashboard */}
        <Section
          eyebrow="Security"
          title="Security Dashboard"
          description="Access anomalies, session hygiene and account safety signals."
          icon={Lock}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {securityKPIs.map((k) => (
              <SecurityCard key={k.label} {...k} />
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl">
            <div className="mb-3 text-sm font-semibold">Failed Login Attempts · 24h</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={alertTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
                <XAxis dataKey="hour" stroke="hsl(0 0% 100% / 0.4)" fontSize={10} />
                <YAxis stroke="hsl(0 0% 100% / 0.4)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(11,15,20,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="alerts"
                  stroke="hsl(0 70% 60%)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Developer Tools */}
        <Section
          eyebrow="Engineering"
          title="Developer Tools"
          description="Read-only environment reference for on-call teams."
          icon={Wrench}
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {devEndpoints.map((d) => (
              <div
                key={d.label}
                className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl"
              >
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {d.label}
                </div>
                {d.type === "code" ? (
                  <code className="mt-2 block truncate text-metric text-xs text-primary">
                    {d.value}
                  </code>
                ) : d.type === "badge" ? (
                  <span className="mt-2 inline-block rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs uppercase tracking-widest text-primary">
                    {d.value}
                  </span>
                ) : d.type === "status" ? (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                    <span className="capitalize">{d.value}</span>
                  </div>
                ) : (
                  <div className="mt-2 text-metric text-sm">{d.value}</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <footer className="border-t border-border/60 pt-6 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          DriveAlert Cockpit OS · Administrator Console · v4.12.0
        </footer>
      </div>
    </div>
  );
}
function Section({ eyebrow, title, description, icon: Icon, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-primary/80">
            {Icon && <Icon className="h-3 w-3" />}
            {eyebrow}
          </div>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </motion.section>
  );
}
