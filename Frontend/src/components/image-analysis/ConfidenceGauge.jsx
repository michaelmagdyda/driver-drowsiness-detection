import { motion } from "framer-motion";
export function ConfidenceGauge({
  value,
  label = "Confidence",
  color = "var(--color-signal-awake)",
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 70;
  const circ = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circ;
  return (
    <div className="relative flex flex-col items-center rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="relative mt-3 h-44 w-44">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="10"
          />
          <motion.circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 10px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-metric text-4xl font-semibold" style={{ color }}>
            {clamped.toFixed(0)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">percent</div>
        </div>
      </div>
    </div>
  );
}
