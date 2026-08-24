import { motion } from "framer-motion";
export function FatigueGauge({ value, size = 220 }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = size / 2 - 18;
  const circumference = 2 * Math.PI * radius;
  // 270deg arc (3/4 circle)
  const arcLength = circumference * 0.75;
  const offset = arcLength * (1 - clamped / 100);
  const color =
    clamped < 30
      ? "var(--color-signal-awake)"
      : clamped < 55
        ? "oklch(0.82 0.16 100)"
        : clamped < 80
          ? "oklch(0.75 0.18 55)"
          : "var(--color-signal-danger)";
  const label =
    clamped < 30 ? "Nominal" : clamped < 55 ? "Elevated" : clamped < 80 ? "High" : "Critical";
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-[135deg]">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={12}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={12}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          filter="url(#gauge-glow)"
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Fatigue
        </div>
        <motion.div
          key={Math.round(clamped)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-metric text-5xl font-semibold"
          style={{ color }}
        >
          {Math.round(clamped)}
        </motion.div>
        <div className="mt-1 text-xs font-medium" style={{ color }}>
          {label}
        </div>
      </div>
    </div>
  );
}
