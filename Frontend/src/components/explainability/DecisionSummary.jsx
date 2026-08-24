import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Activity,
  Eye,
  MessageSquare,
  Compass,
  Timer,
  Cpu,
  ShieldAlert,
  Gauge,
  Tag,
} from "lucide-react";
import { decisionSummary } from "./mockData";
function useCounter(target, decimals = 0, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v.toFixed(decimals);
}
function KPI({ icon: Icon, label, value, sub, accent, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-panel group relative overflow-hidden rounded-xl border border-border/50 p-4"
    >
      <div className={`absolute inset-x-0 top-0 h-px ${accent ?? "bg-primary/40"}`} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tracking-tight">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className="rounded-lg border border-border/50 bg-card/60 p-2 text-primary transition group-hover:scale-105">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
}
export function DecisionSummary() {
  const score = useCounter(decisionSummary.fatigueScore);
  const conf = useCounter(decisionSummary.confidence, 1);
  const ear = useCounter(decisionSummary.ear, 2);
  const mar = useCounter(decisionSummary.mar, 2);
  const inf = useCounter(decisionSummary.inferenceMs);
  const gpu = useCounter(decisionSummary.gpuLoad);
  const cards = [
    {
      icon: AlertTriangle,
      label: "Driver Status",
      value: decisionSummary.status,
      sub: "Live prediction",
      accent: "bg-amber-500/60",
    },
    {
      icon: Gauge,
      label: "Fatigue Score",
      value: `${score}/100`,
      sub: "PERCLOS-weighted",
      accent: "bg-red-500/60",
    },
    { icon: Activity, label: "Confidence", value: `${conf}%`, sub: "Softmax margin" },
    { icon: Eye, label: "EAR", value: ear, sub: "Eye Aspect Ratio" },
    { icon: MessageSquare, label: "MAR", value: mar, sub: "Mouth Aspect Ratio" },
    {
      icon: Compass,
      label: "Head Pose",
      value: `Y${decisionSummary.headPose.yaw}° P${decisionSummary.headPose.pitch}°`,
      sub: `Roll ${decisionSummary.headPose.roll}°`,
    },
    {
      icon: Timer,
      label: "Inference",
      value: `${inf} ms`,
      sub: `${Math.round(1000 / decisionSummary.inferenceMs)} FPS avg`,
    },
    {
      icon: ShieldAlert,
      label: "Risk Level",
      value: decisionSummary.risk,
      sub: "Escalation policy",
      accent: "bg-red-500/60",
    },
    { icon: Cpu, label: "GPU Load", value: `${gpu}%`, sub: decisionSummary.gpu },
    { icon: Tag, label: "Model", value: decisionSummary.model, sub: "Active weights" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((c, i) => (
        <KPI key={c.label} {...c} delay={i * 0.04} />
      ))}
    </div>
  );
}
