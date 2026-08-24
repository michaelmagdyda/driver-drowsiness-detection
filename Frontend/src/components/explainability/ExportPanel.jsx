import { Button } from "@/components/ui/button";
import { FileDown, FileJson, FileSpreadsheet, FileText, PlayCircle } from "lucide-react";
const items = [
  { icon: FileText, label: "Export PDF" },
  { icon: FileJson, label: "Export JSON" },
  { icon: FileSpreadsheet, label: "Export CSV" },
  { icon: FileDown, label: "Explainability Report" },
  { icon: PlayCircle, label: "Session Replay" },
];
export function ExportPanel() {
  return (
    <section className="glass-panel rounded-2xl border border-border/50 p-5">
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold">Export Center</h2>
        <p className="text-xs text-muted-foreground">
          Package explainability artefacts for review, audit, or handoff.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <Button key={i.label} variant="outline" className="gap-2 border-border/60">
            <i.icon className="h-4 w-4" /> {i.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
