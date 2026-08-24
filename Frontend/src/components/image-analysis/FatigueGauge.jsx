import { motion } from "framer-motion";
const STOPS = [
  { at: 0, color: "var(--color-signal-awake)" },
  { at: 45, color: "var(--color-signal-drowsy)" },
  { at: 75, color: "var(--color-signal-danger)" },
];
function colorFor(v) {
  let c = STOPS[0].color;
  for (const s of STOPS) if (v >= s.at) c = s.color;
  return c;
}
export function FatigueGauge({ value }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = colorFor(clamped);
  const angle = (clamped / 100) * 220 - 110;
  return (
    <div className="relative rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Fatigue meter
      </div>
      <div className="relative mx-auto mt-2 h-44 w-full max-w-[260px]">
        <svg viewBox="0 0 240 160" className="h-full w-full">
          <defs>
            <linearGradient id="fatigueArc" x1="0" x2="1">
              <stop offset="0%" stopColor="var(--color-signal-awake)" />
              <stop offset="50%" stopColor="var(--color-signal-drowsy)" />
              <stop offset="100%" stopColor="var(--color-signal-danger)" />
            </linearGradient>
          </defs>
          <path
            d="M 30 130 A 90 90 0 1 1 210 130"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 30 130 A 90 90 0 1 1 210 130"
            fill="none"
            stroke="url(#fatigueArc)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray="440"
            strokeDashoffset={440 - (clamped / 100) * 440}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
          <motion.line
            x1="120"
            y1="130"
            x2="120"
            y2="60"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            style={{ transformOrigin: "120px 130px", filter: `drop-shadow(0 0 6px ${color})` }}
            initial={{ rotate: -110 }}
            animate={{ rotate: angle }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          <circle cx="120" cy="130" r="6" fill={color} />
        </svg>
        <div className="absolute inset-x-0 bottom-2 flex flex-col items-center">
          <div className="text-metric text-3xl font-semibold" style={{ color }}>
            {clamped.toFixed(0)}
            <span className="ml-1 text-sm text-muted-foreground">/100</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {clamped < 45 ? "Nominal" : clamped < 75 ? "Elevated" : "Critical"}
          </div>
        </div>
      </div>
    </div>
  );
}
