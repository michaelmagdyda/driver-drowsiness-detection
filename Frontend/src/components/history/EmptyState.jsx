import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Radio, History } from "lucide-react";
export function EmptyState() {
  return (
    <Card className="glass-panel flex flex-col items-center justify-center border-border/50 p-16 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative mb-6"
      >
        <div className="absolute inset-0 animate-pulse rounded-3xl bg-primary/20 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/40 bg-primary/10">
          <History className="h-9 w-9 text-primary" />
        </div>
      </motion.div>
      <h3 className="font-display text-xl font-semibold">No monitoring sessions available yet.</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Once you start monitoring drivers, sessions and AI detection results will appear here.
      </p>
      <Button asChild className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
        <Link to="/monitoring">
          <Radio className="mr-2 h-4 w-4" /> Start New Monitoring Session
        </Link>
      </Button>
    </Card>
  );
}
