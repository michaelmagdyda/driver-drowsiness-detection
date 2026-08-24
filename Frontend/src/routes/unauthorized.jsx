import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
export const Route = createFileRoute("/unauthorized")({
  component: UnauthorizedPage,
});
function UnauthorizedPage() {
  const router = useRouter();
  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cockpit px-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-danger/20 blur-[120px]" />
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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-signal-danger/40 bg-signal-danger/10">
          <ShieldAlert className="h-7 w-7 text-signal-danger" />
        </div>

        <div className="mt-6 text-metric text-xs font-semibold uppercase tracking-[0.24em] text-signal-danger">
          Error · 403
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
          Access restricted
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You don't have permission to view this page. If you believe this is a mistake, contact
          your administrator.
        </p>

        <div className="mt-8 flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
          <Button
            variant="outline"
            className="w-full border-border/70 bg-background/40"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
