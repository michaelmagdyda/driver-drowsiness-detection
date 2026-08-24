import { Card } from "@/components/ui/card";
import { Sparkles, Trophy, FileText, Cpu, ShieldCheck, Moon, Lock } from "lucide-react";
import { achievements } from "./mockData";
import { cn } from "@/lib/utils";
const ICONS = { Sparkles, Trophy, FileText, Cpu, ShieldCheck, Moon };
export function AchievementCard() {
  const unlocked = achievements.filter((a) => a.unlocked).length;
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-display text-base font-semibold">Achievements</div>
          <div className="text-xs text-muted-foreground">Milestones across your journey.</div>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {unlocked}/{achievements.length} unlocked
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((a) => {
          const Icon = ICONS[a.icon] ?? Sparkles;
          return (
            <div
              key={a.name}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border p-3",
                a.unlocked
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/50 bg-background/30 opacity-60",
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border",
                  a.unlocked
                    ? "border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_-6px_var(--color-primary)]"
                    : "border-border/50 bg-muted/20 text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {a.name}
                  {!a.unlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">{a.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
