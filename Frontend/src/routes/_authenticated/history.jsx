import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertTriangle, History as HistoryIcon, Loader2 } from "lucide-react";
import { listSessions, listSessionEvents, getSession, deleteSession, ApiError } from "@/lib/api";
import { StatisticsCards } from "@/components/history/StatisticsCards";
import { FilterPanel, DEFAULT_FILTERS } from "@/components/history/FilterPanel";
import { HistoryTable } from "@/components/history/HistoryTable";
import { SessionDetailPanel } from "@/components/history/SessionDetailPanel";
import { DetectionTimeline } from "@/components/history/DetectionTimeline";
import { ReplayPlayer } from "@/components/history/ReplayPlayer";
import { DownloadCards } from "@/components/history/DownloadCards";
import { EmptyState } from "@/components/history/EmptyState";
export const Route = createFileRoute("/_authenticated/history")({
  validateSearch: (search) => ({
    session: typeof search.session === "string" ? search.session : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Detection History · DriveAlert Cockpit" },
      {
        name: "description",
        content: "Review previous AI drowsiness monitoring sessions and their event timelines.",
      },
      { property: "og:title", content: "Detection History · DriveAlert Cockpit" },
      {
        property: "og:description",
        content: "Session history and event replay for DriveAlert monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

const TIMELINE_SEVERITY = {
  SAFE: "info",
  WARNING: "medium",
  DANGER: "high",
  EMERGENCY: "critical",
};

function eventToTimelineEntry(event) {
  const type = event.yawning
    ? "yawn"
    : event.eyeClosed
      ? "eyes-closed"
      : event.state === "SLEEPING"
        ? "sleep"
        : event.alertLevel !== "SAFE"
          ? "warning"
          : "recovered";
  const label =
    {
      yawn: "Yawn detected",
      "eyes-closed": "Eyes closed",
      sleep: "Driver classified sleeping",
      warning: `Alert level: ${event.alertLevel}`,
      recovered: `State: ${event.state}`,
    }[type] ?? event.state;
  return {
    t: new Date(event.ts).toLocaleTimeString(),
    type,
    label,
    severity: TIMELINE_SEVERITY[event.alertLevel] ?? "info",
  };
}

function HistoryPage() {
  const { session: sessionParam } = Route.useSearch();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | done | error
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [timelineStatus, setTimelineStatus] = useState("idle");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    listSessions({ page: 1, pageSize: 100 })
      .then((result) => {
        if (cancelled) return;
        setSessions(result.items);
        // A deep link from Upload (?session=<id>) selects that session on
        // first load, if it's actually in this page of results.
        const deepLinked = result.items.some((s) => s.id === sessionParam);
        setSelectedId(deepLinked ? sessionParam : (result.items[0]?.id ?? null));
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load sessions.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // Deep link is only meant to apply on the initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filters.type !== "all" && s.source !== filters.type) return false;
      if (filters.status !== "all" && s.status !== filters.status) return false;
      if (filters.driverState !== "all" && s.finalState !== filters.driverState) return false;
      if (filters.severity !== "all" && s.alertLevel !== filters.severity) return false;
      if (query && !s.id.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [sessions, filters, query]);

  const selected = filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId);
        setSelectedId((current) => (current === sessionId ? (next[0]?.id ?? null) : current));
        return next;
      });
      toast.success("Session deleted.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete the session.");
    }
  };

  useEffect(() => {
    if (!selected) {
      setTimeline([]);
      setRawEvents([]);
      setSessionDetail(null);
      return;
    }
    let cancelled = false;
    setTimelineStatus("loading");
    // The list view's `selected` row has no `media` field (only GET
    // /sessions/{id} resolves the linked recording) - fetch the detail
    // alongside events so Replay/Downloads have what they need.
    Promise.all([
      listSessionEvents(selected.id, { page: 1, pageSize: 100 }),
      getSession(selected.id),
    ])
      .then(([result, detail]) => {
        if (cancelled) return;
        setTimeline(result.items.map(eventToTimelineEntry));
        setRawEvents(result.items);
        setSessionDetail(detail);
        setTimelineStatus("done");
      })
      .catch(() => {
        if (cancelled) return;
        setTimeline([]);
        setRawEvents([]);
        setSessionDetail(null);
        setTimelineStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // Refetch only when the selected id changes, not on every `filtered` recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border/40 bg-gradient-to-b from-cockpit/80 to-transparent px-6 py-6 lg:px-10">
        <Breadcrumb className="mb-3">
          <BreadcrumbList className="text-[11px]">
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/dashboard"
                className="text-muted-foreground hover:text-primary"
              >
                Cockpit
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground">Detection History</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 shadow-[0_0_28px_-8px_var(--color-primary)]">
                <HistoryIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight lg:text-3xl">
                  Detection History
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Review sessions and replay their detection timelines.
                </p>
              </div>
            </div>
          </motion.div>

          <Avatar className="hidden h-9 w-9 border border-border/50 lg:flex">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              DA
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6 lg:px-10">
        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card/40 p-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <div className="font-medium">Could not load session history</div>
              <div className="mt-0.5 text-xs text-destructive/80">{error}</div>
            </div>
          </div>
        )}

        {status === "done" && (
          <>
            <StatisticsCards sessions={filtered} />
            <FilterPanel
              value={filters}
              onChange={setFilters}
              query={query}
              onQueryChange={setQuery}
            />

            {sessions.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <HistoryTable
                      sessions={filtered}
                      selectedId={selected?.id ?? null}
                      onSelect={setSelectedId}
                      isAdmin={false}
                    />
                  </div>
                  <div className="xl:col-span-1">
                    <SessionDetailPanel
                      session={selected}
                      onClose={() => setSelectedId(null)}
                      onDelete={handleDeleteSession}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {timelineStatus === "loading" ? (
                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card/40 p-10 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading timeline…
                    </div>
                  ) : (
                    <DetectionTimeline events={timeline} />
                  )}
                  {sessionDetail && <ReplayPlayer session={sessionDetail} events={rawEvents} />}
                </div>

                {sessionDetail && timelineStatus === "done" && (
                  <div>
                    <div className="mb-3">
                      <h2 className="font-display text-lg font-semibold">Downloads</h2>
                      <p className="text-xs text-muted-foreground">
                        Generated from this session's real data — no report backend needed.
                      </p>
                    </div>
                    <DownloadCards session={sessionDetail} events={rawEvents} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
