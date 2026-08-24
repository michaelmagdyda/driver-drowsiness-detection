import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw, X, CircleDot } from "lucide-react";
export function SaveBar({ dirty, onSave, onReset, onDiscard }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
        >
          <div className="glass-panel pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-background/80 p-3 pl-4 shadow-[0_20px_60px_-20px_var(--color-primary)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <div className="text-sm">
                <span className="font-medium">Unsaved changes.</span>{" "}
                <span className="text-muted-foreground">Review and apply your configuration.</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={onDiscard} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Discard
              </Button>
              <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
              <Button size="sm" onClick={onSave} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Save changes
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export function SavedIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
      <CircleDot className="h-3 w-3" /> Autosaved
    </div>
  );
}
