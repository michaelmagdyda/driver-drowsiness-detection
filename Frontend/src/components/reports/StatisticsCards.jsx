import { motion } from "framer-motion";
import {
  FileText,
  Camera,
  Video,
  Image as ImageIcon,
  ShieldCheck,
  AlertTriangle,
  Gauge,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "@/components/history/mockData";

function useCountUp(target, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

/** Real counts and averages over the caller's own sessions - no separate reports table exists. */
export function StatisticsCards({ sessions }) {
  const bySource = { webcam: 0, video: 0, image: 0, dashcam: 0 };
  let totalAlerts = 0;
  let safeCount = 0;
  const fatigueValues = [];
  const durationValues = [];
  for (const s of sessions) {
    bySource[s.source] = (bySource[s.source] ?? 0) + 1;
    totalAlerts += s.totalAlerts ?? 0;
    if (s.finalState === "AWAKE") safeCount += 1;
    if (s.maxFatigueScore != null) fatigueValues.push(s.maxFatigueScore);
    if (s.durationSeconds != null) durationValues.push(s.durationSeconds);
  }
  const avgFatigue = fatigueValues.length
    ? Math.round(fatigueValues.reduce((a, b) => a + b, 0) / fatigueValues.length)
    : null;
  const avgDurationSec = durationValues.length
    ? Math.round(durationValues.reduce((a, b) => a + b, 0) / durationValues.length)
    : null;

  const items = [
    { key: "total", label: "Total Sessions", value: sessions.length, icon: FileText },
    { key: "webcam", label: "Webcam Sessions", value: bySource.webcam, icon: Camera },
    { key: "video", label: "Video Sessions", value: bySource.video, icon: Video },
    { key: "image", label: "Image Sessions", value: bySource.image, icon: ImageIcon },
    { key: "safe", label: "Safe Sessions", value: safeCount, icon: ShieldCheck },
    { key: "alerts", label: "Total Alerts", value: totalAlerts, icon: AlertTriangle },
    {
      key: "fatigue",
      label: "Avg Fatigue",
      value: avgFatigue ?? 0,
      unit: avgFatigue != null ? "%" : "",
      icon: Gauge,
    },
    {
      key: "duration",
      label: "Avg Duration",
      value: avgDurationSec != null ? formatDuration(avgDurationSec) : "—",
      icon: Timer,
      isString: true,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {items.map((it, i) => (
        <motion.div
          key={it.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="glass-panel rounded-xl border border-border/60 p-4"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <it.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 font-display text-2xl font-semibold tracking-tight">
            {it.isString ? it.value : <Counter target={Number(it.value)} />}
            {it.unit && <span className="ml-0.5 text-sm text-muted-foreground">{it.unit}</span>}
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            {it.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
function Counter({ target }) {
  const n = useCountUp(target);
  return <>{n.toLocaleString()}</>;
}
