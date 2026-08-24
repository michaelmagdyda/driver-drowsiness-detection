import { motion } from "framer-motion";
const TONE = {
  default: "var(--color-signal-awake)",
  awake: "var(--color-signal-awake)",
  drowsy: "var(--color-signal-drowsy)",
  danger: "var(--color-signal-danger)",
};
export function MetricCard({ label, value, unit, icon: Icon, delta, tone = "default", sparkline }) {
  const color = TONE[tone];
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl"
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        {Icon && (
          <div
            className="grid h-6 w-6 place-items-center rounded-md"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <Icon className="h-3 w-3" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <div className="text-metric text-2xl font-semibold" style={{ color }}>
          {value}
        </div>
        {unit && <div className="text-xs text-muted-foreground">{unit}</div>}
      </div>
      {delta && <div className="mt-0.5 text-[10px] text-muted-foreground">{delta}</div>}
      {sparkline && sparkline.length > 1 && (
        <svg viewBox="0 0 100 24" className="mt-2 h-6 w-full">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={sparkline
              .map((v, i) => {
                const x = (i / (sparkline.length - 1)) * 100;
                const min = Math.min(...sparkline);
                const max = Math.max(...sparkline);
                const norm = max === min ? 0.5 : (v - min) / (max - min);
                const y = 22 - norm * 20;
                return `${x},${y}`;
              })
              .join(" ")}
          />
        </svg>
      )}
    </motion.div>
  );
}
