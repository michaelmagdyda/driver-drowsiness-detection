import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bell,
  Siren,
  AlertTriangle,
  CheckCircle2,
  Mail,
  MessageCircle,
  Volume2,
  Timer,
  ChevronRight,
  Search,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatisticsCard } from "@/components/alerts/StatisticsCard";
import { AlertFeed } from "@/components/alerts/AlertFeed";
import { AlertDetailDrawer } from "@/components/alerts/AlertDetailDrawer";
import { FilterPanel } from "@/components/alerts/FilterPanel";
import { AlertAnalytics } from "@/components/alerts/AlertAnalytics";
import { SettingsShortcut } from "@/components/alerts/SettingsShortcut";
import { MOCK_ALERTS, KPI_STATS } from "@/components/alerts/mockData";
export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Alert Center — DriveAlert" },
      {
        name: "description",
        content:
          "Real-time alert triage, notification delivery, and safety analytics for AI driver monitoring.",
      },
      { property: "og:title", content: "Alert Center — DriveAlert" },
      {
        property: "og:description",
        content: "Mission control for driver drowsiness alerts and notifications.",
      },
    ],
  }),
  component: AlertsPage,
});
function AlertsPage() {
  const [selected, setSelected] = useState(MOCK_ALERTS[0] ?? null);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query) return MOCK_ALERTS;
    const q = query.toLowerCase();
    return MOCK_ALERTS.filter(
      (a) =>
        a.driverName.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.sessionId.toLowerCase().includes(q),
    );
  }, [query]);
  return (
    <div className="mx-auto max-w-[1600px] space-y-8 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Cockpit</span>
            <ChevronRight className="h-3 w-3" />
            <span>Insights</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Alerts</span>
          </div>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Alert Center
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-red-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
              Live
            </span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mission control for safety alerts — triage, acknowledge, and analyze notifications
            across your fleet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search alerts, drivers, sessions…"
              className="h-9 w-72 border-border/60 bg-card/60 pl-8 text-sm backdrop-blur"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Notification Center
          </Button>
        </div>
      </header>

      {/* KPI Overview */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatisticsCard
          label="Active Alerts"
          value={KPI_STATS.active}
          icon={Bell}
          tone="danger"
          trend={12}
        />
        <StatisticsCard
          label="Critical"
          value={KPI_STATS.critical}
          icon={Siren}
          tone="danger"
          trend={4}
        />
        <StatisticsCard
          label="Warnings"
          value={KPI_STATS.warning}
          icon={AlertTriangle}
          tone="warning"
          trend={-3}
        />
        <StatisticsCard
          label="Resolved"
          value={KPI_STATS.resolved}
          icon={CheckCircle2}
          tone="primary"
          trend={18}
        />
        <StatisticsCard
          label="Emails Sent"
          value={KPI_STATS.emails}
          icon={Mail}
          tone="info"
          trend={7}
        />
        <StatisticsCard
          label="WhatsApp"
          value={KPI_STATS.whatsapp}
          icon={MessageCircle}
          tone="info"
          trend={9}
        />
        <StatisticsCard
          label="Alarms"
          value={KPI_STATS.alarms}
          icon={Volume2}
          tone="warning"
          trend={2}
        />
        <StatisticsCard
          label="Avg Response"
          value={KPI_STATS.avgResponseSec}
          suffix="s"
          icon={Timer}
          tone="primary"
          trend={-6}
        />
      </section>

      {/* Filters */}
      <FilterPanel />

      {/* Feed + Detail */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AlertFeed alerts={filtered} selectedId={selected?.id} onSelect={setSelected} />
        </div>
        <div className="lg:col-span-2">
          <AlertDetailDrawer alert={selected} onClose={() => setSelected(null)} />
        </div>
      </section>

      {/* Analytics */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Alert Analytics</h2>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Trends · distribution · reliability
            </p>
          </div>
        </div>
        <AlertAnalytics />
      </section>

      {/* Settings shortcut */}
      <SettingsShortcut />
    </div>
  );
}
