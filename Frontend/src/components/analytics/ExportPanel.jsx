import { motion } from "framer-motion";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Only two real exports - the currently-loaded trends data, in the two
// formats that need no server-side report pipeline. PDF/Excel/dashboard
// snapshots were dropped rather than faked: no such generator exists here.
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toDailyCsv(sessionTrends) {
  const byDate = new Map();
  for (const { date, count } of sessionTrends.sessionsPerDay) {
    byDate.set(date, { date, sessions: count, avgFatigue: "" });
  }
  for (const { date, averageFatigueScore } of sessionTrends.avgFatiguePerDay) {
    const row = byDate.get(date) ?? { date, sessions: 0, avgFatigue: "" };
    row.avgFatigue = Math.round(averageFatigueScore);
    byDate.set(date, row);
  }
  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const header = "date,sessions,avg_fatigue_score";
  return [header, ...rows.map((r) => `${r.date},${r.sessions},${r.avgFatigue}`)].join("\n");
}

const ITEMS = [
  {
    key: "json",
    label: "JSON Payload",
    description: "Full session + event trends, as returned by the API",
    icon: FileJson,
  },
  {
    key: "csv",
    label: "CSV Export",
    description: "Daily session count and average fatigue",
    icon: FileSpreadsheet,
  },
];

export function ExportPanel({ sessionTrends, eventTrends }) {
  const handlers = {
    json: () =>
      download(
        "analytics.json",
        JSON.stringify({ sessionTrends, eventTrends }, null, 2),
        "application/json",
      ),
    csv: () => download("analytics-daily.csv", toDailyCsv(sessionTrends), "text/csv"),
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ITEMS.map((item, i) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Card className="glass-panel group flex h-full flex-col justify-between border-border/50 p-4 transition-all hover:border-primary/40">
            <div>
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="font-display text-sm font-semibold">{item.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{item.description}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 h-8 border-border/60 bg-card/40 text-xs group-hover:border-primary/40"
              onClick={handlers[item.key]}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </Button>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
