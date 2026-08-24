import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Sparkles, Activity } from "lucide-react";
import { sessionMeta } from "./mockData";
export function ExplainabilityHeader() {
  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl border border-border/50 p-6">
      <div className="absolute inset-0 -z-10 opacity-40 [background:radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--color-primary)_18%,transparent),transparent_60%)]" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Explainable AI · XAI v2
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            AI Explainability Dashboard
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Inspect every stage of the drowsiness pipeline — from raw frame to alert. Understand
            <span className="text-foreground"> how </span> and
            <span className="text-foreground"> why </span> the model reached its decision.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
              Session {sessionMeta.sessionId}
            </Badge>
            <Badge variant="outline" className="border-border/60">
              Driver · {sessionMeta.driver}
            </Badge>
            <Badge variant="outline" className="border-border/60">
              Model · {sessionMeta.modelVersion}
            </Badge>
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
              Prediction · {sessionMeta.prediction}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row lg:items-center">
          <div className="glass-panel flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3">
            <Activity className="h-4 w-4 text-primary" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Overall confidence
              </div>
              <div className="font-mono text-lg font-semibold text-foreground">
                {(sessionMeta.overallConfidence * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Export Explainability Report
          </Button>
        </div>
      </div>
    </div>
  );
}
