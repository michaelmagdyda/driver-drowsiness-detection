import { Card } from "@/components/ui/card";
import { AlertTriangle, Loader2 } from "lucide-react";

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="font-mono text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

/**
 * The trained model's real held-out test-set evaluation - shared between
 * Analytics and Reports so both pages render the exact same real numbers
 * from the same `getAIPerformance()` call rather than duplicating the markup.
 */
export function AIPerformanceCard({ aiPerf, error }) {
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> {error}
      </div>
    );
  }
  if (!aiPerf) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/40 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading evaluation metrics…
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="glass-panel border-border/50 p-5">
        <div className="mb-4">
          <div className="font-display text-sm font-semibold">Held-out test-set evaluation</div>
          <div className="text-[11px] text-muted-foreground">
            {aiPerf.numTestImages.toLocaleString()} test images · IoU threshold{" "}
            {aiPerf.iouThreshold}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Precision" value={aiPerf.precision.toFixed(3)} />
          <Metric label="Recall" value={aiPerf.recall.toFixed(3)} />
          <Metric label="F1 Score" value={aiPerf.f1.toFixed(3)} />
          <Metric label="Mean IoU" value={aiPerf.meanIou.toFixed(3)} />
          <Metric label="Detection Accuracy" value={aiPerf.detectionAccuracy.toFixed(3)} />
          <Metric label="mAP@0.50" value={aiPerf.map50.toFixed(3)} />
          <Metric label="mAP@0.50:0.95" value={aiPerf.map5095.toFixed(3)} />
        </div>
      </Card>

      <Card className="glass-panel border-border/50 p-5">
        <div className="mb-4">
          <div className="font-display text-sm font-semibold">Average Precision by Class</div>
          <div className="text-[11px] text-muted-foreground">From the same held-out evaluation</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {aiPerf.apPerClass.map((c) => (
            <Metric
              key={c.label}
              label={c.label.replace("_", " ")}
              value={c.averagePrecision.toFixed(3)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
