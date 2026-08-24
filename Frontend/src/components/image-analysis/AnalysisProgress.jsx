import { motion } from "framer-motion";
import { Cpu, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
export function AnalysisProgress({ progress, stage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/40 bg-card/40 p-5 backdrop-blur-xl shadow-[0_0_40px_-16px_var(--color-primary)]"
    >
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            <div className="font-display text-sm font-semibold">Running AI inference</div>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{stage}</div>
        </div>
        <div className="text-metric text-2xl font-semibold text-primary">
          {Math.round(progress)}%
        </div>
      </div>
      <Progress value={progress} className="mt-4 h-1.5" />
    </motion.div>
  );
}
