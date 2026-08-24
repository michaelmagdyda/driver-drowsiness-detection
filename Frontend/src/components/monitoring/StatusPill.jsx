export function StatusPill({ label, value, ok, icon: Icon }) {
  const color = ok ? "var(--color-signal-awake)" : "var(--color-signal-danger)";
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/40 px-3 py-2 backdrop-blur">
      <div
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md"
        style={{ backgroundColor: `${color}15`, color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="truncate text-xs font-medium">{value}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  );
}
