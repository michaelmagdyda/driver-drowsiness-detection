import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, ChevronRight, Search, Cpu, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatisticsCards } from "@/components/reports/StatisticsCards";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { ExportCenter } from "@/components/reports/ExportCenter";
import { HistoryTable } from "@/components/history/HistoryTable";
import { SessionDetailPanel } from "@/components/history/SessionDetailPanel";
import { EmptyState } from "@/components/history/EmptyState";
import { AIPerformanceCard } from "@/components/analytics/AIPerformanceCard";
import { listSessions, getSession, listSessionEvents, getAIPerformance, ApiError } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports Center — DriveAlert" },
      {
        name: "description",
        content:
          "Real, exportable reports built from your own webcam, video, and image analysis sessions.",
      },
      { property: "og:title", content: "Reports Center — DriveAlert" },
      {
        property: "og:description",
        content: "Real driver-monitoring reports, built from real sessions.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [sessions, setSessions] = useState([]);
  const [sessionsStatus, setSessionsStatus] = useState("loading");
  const [sessionsError, setSessionsError] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [sessionDetail, setSessionDetail] = useState(null);
  const [rawEvents, setRawEvents] = useState([]);
  const [detailStatus, setDetailStatus] = useState("idle");

  const [aiPerf, setAiPerf] = useState(null);
  const [aiPerfError, setAiPerfError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSessionsStatus("loading");
    listSessions({ page: 1, pageSize: 100 })
      .then((result) => {
        if (cancelled) return;
        setSessions(result.items);
        setSelectedId((current) => current ?? result.items[0]?.id ?? null);
        setSessionsStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionsError(err instanceof ApiError ? err.message : "Failed to load sessions.");
        setSessionsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getAIPerformance()
      .then(setAiPerf)
      .catch((err) => setAiPerfError(err instanceof ApiError ? err.message : "Unavailable."));
  }, []);

  const filtered = sessions.filter(
    (s) => !query || s.id.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setSessionDetail(null);
      setRawEvents([]);
      return;
    }
    let cancelled = false;
    setDetailStatus("loading");
    Promise.all([
      getSession(selected.id),
      listSessionEvents(selected.id, { page: 1, pageSize: 100 }),
    ])
      .then(([detail, events]) => {
        if (cancelled) return;
        setSessionDetail(detail);
        setRawEvents(events.items);
        setDetailStatus("done");
      })
      .catch(() => {
        if (cancelled) return;
        setSessionDetail(null);
        setRawEvents([]);
        setDetailStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // Refetch only when the selected id changes, not on every `filtered` recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Cockpit</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Reports</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Reports Center
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Real, exportable reports built from your own webcam, video, and image analysis sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by session id…"
              className="h-10 w-64 pl-8"
            />
          </div>
          <Button
            className="gap-1.5"
            onClick={() =>
              document.getElementById("report-builder")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <FileText className="h-4 w-4" /> Build a Report
          </Button>
        </div>
      </header>

      {sessionsStatus === "loading" && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card/40 p-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
        </div>
      )}

      {sessionsStatus === "error" && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <div className="font-medium">Could not load sessions</div>
            <div className="mt-0.5 text-xs text-destructive/80">{sessionsError}</div>
          </div>
        </div>
      )}

      {sessionsStatus === "done" &&
        (sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <section>
              <StatisticsCards sessions={sessions} />
            </section>

            <section id="report-builder">
              <ReportBuilder session={sessionDetail} events={rawEvents} status={detailStatus} />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <HistoryTable
                  sessions={filtered}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                  isAdmin={false}
                />
              </div>
              <div className="lg:col-span-2">
                <SessionDetailPanel session={selected} onClose={() => setSelectedId(null)} />
              </div>
            </section>

            <section>
              <ExportCenter session={sessionDetail} events={rawEvents} />
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  AI Performance Report
                </h2>
              </div>
              <AIPerformanceCard aiPerf={aiPerf} error={aiPerfError} />
            </section>
          </>
        ))}

      <footer className="flex items-center border-t border-border/40 pt-4 text-[11px] text-muted-foreground">
        <FileText className="mr-1.5 h-3 w-3" /> DriveAlert Reports
      </footer>
    </div>
  );
}
