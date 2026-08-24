import { CheckCircle2, XCircle, HardDrive, Calendar, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One real checkpoint file, with a real compatibility flag (an actual
 * dry-run load against the current architecture, not a guess from the
 * filename) and a real "Set Active" action.
 */
export function ModelCard({ checkpoint, onActivate, activating }) {
  const { filename, directory, sizeBytes, modifiedAt, compatible, incompatibleReason, active } =
    checkpoint;
  return (
    <div
      className={`rounded-2xl border p-5 backdrop-blur-xl ${active ? "border-primary/50 bg-primary/5 shadow-[0_0_40px_-12px_var(--color-primary)]" : "border-border/60 bg-card/60"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border ${active ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 bg-background/40 text-muted-foreground"}`}
          >
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium">{filename}</div>
            <div className="text-metric text-[11px] text-muted-foreground">
              {directory || "checkpoints root"}
            </div>
          </div>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] uppercase tracking-widest ${
            compatible
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {compatible ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {compatible ? "Compatible" : "Incompatible"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/50 bg-background/40 p-2">
          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">
            <HardDrive className="h-3 w-3" /> Size
          </div>
          <div className="text-metric mt-0.5 text-sm font-semibold">{formatSize(sizeBytes)}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 p-2">
          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">
            <Calendar className="h-3 w-3" /> Modified
          </div>
          <div className="text-metric mt-0.5 text-sm font-semibold">
            {new Date(modifiedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {!compatible && incompatibleReason && (
        <p className="mt-3 text-[11px] text-destructive">{incompatibleReason}</p>
      )}

      <div className="mt-4 flex gap-2">
        {active ? (
          <div className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 text-[11px] font-medium text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> Active model
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 border-primary/40 text-primary disabled:opacity-40"
            disabled={!compatible || activating}
            onClick={onActivate}
          >
            {activating ? "Activating…" : "Set Active"}
          </Button>
        )}
      </div>
    </div>
  );
}
