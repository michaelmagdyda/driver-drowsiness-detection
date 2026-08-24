import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Clock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
export const Route = createFileRoute("/session-expired")({
  component: SessionExpiredPage,
});
function SessionExpiredPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cockpit px-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-drowsy/20 blur-[120px]" />
      </div>

      <div className="fixed right-4 top-4 z-40">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-2xl border border-border/60 bg-card/70 p-10 text-center backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-signal-drowsy/40 bg-signal-drowsy/10">
          <Clock className="h-7 w-7 text-signal-drowsy" />
        </div>

        <div className="mt-6 text-metric text-xs font-semibold uppercase tracking-[0.24em] text-signal-drowsy">
          Session · Expired
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
          You've been signed out
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          For your safety, we ended your session after a period of inactivity. Please sign in again
          to continue.
        </p>

        <Button asChild className="mt-8 w-full">
          <Link to="/auth">
            <LogIn className="mr-2 h-4 w-4" /> Sign in again
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
