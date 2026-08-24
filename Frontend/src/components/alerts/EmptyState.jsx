import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
export function EmptyState() {
  return (
    <Card className="glass-panel flex flex-col items-center justify-center border-border/50 p-12 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary">
        <ShieldCheck className="h-8 w-8" />
        <div className="absolute -inset-2 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
      </div>
      <div className="mt-4 font-display text-lg font-semibold">No alerts have been generated</div>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        The cockpit is quiet. Once monitoring begins, real-time alerts will appear here.
      </p>
      <Button className="mt-5">Start Monitoring</Button>
    </Card>
  );
}
