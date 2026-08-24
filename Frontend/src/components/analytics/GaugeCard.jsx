export function GaugeCard({
  value,
  max = 100,
  label,
  unit = "%",
  color = "var(--color-signal-awake)",
}) {
  const pct = Math.min(1, Math.max(0, value / max));
  const size = 140;
  const r = 58;
  const c = 2 * Math.PI * r;
  const arc = 0.75 * c;
  const offset = arc * (1 - pct);
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size * 0.78 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-[135deg]"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={10}
            strokeDasharray={`${arc} ${c}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeDasharray={`${arc} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 700ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-2xl font-semibold">
            {value}
            <span className="text-sm text-muted-foreground">{unit}</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
