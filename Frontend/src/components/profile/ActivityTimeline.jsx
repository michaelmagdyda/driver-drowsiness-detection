import { Card } from "@/components/ui/card";
import {
  LogIn,
  Radio,
  Video,
  FileText,
  Download,
  Settings,
  Bell,
  Image as ImageIcon,
} from "lucide-react";
import { activityFeed } from "./mockData";
import { cn } from "@/lib/utils";
const ICONS = {
  LogIn,
  Radio,
  Video,
  FileText,
  Download,
  Settings,
  Bell,
  Image: ImageIcon,
};
const STATUS = {
  success: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  info: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  warning: "text-amber-300 border-amber-400/30 bg-amber-400/10",
};
export function ActivityTimeline() {
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-display text-base font-semibold">Recent activity</div>
          <div className="text-xs text-muted-foreground">Latest events across your account.</div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          last 48h
        </span>
      </div>

      <ol className="relative space-y-4 border-l border-border/50 pl-5">
        {activityFeed.map((a) => {
          const Icon = ICONS[a.icon] ?? Radio;
          return (
            <li key={a.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[30px] flex h-6 w-6 items-center justify-center rounded-full border bg-background",
                  STATUS[a.status] ?? STATUS.info,
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm">{a.title}</div>
                <div className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {a.ts}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
