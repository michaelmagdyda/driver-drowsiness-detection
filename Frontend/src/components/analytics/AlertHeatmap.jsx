const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Real day-of-week x hour-of-day alert heatmap.
 *
 * `cells` is the sparse `EventTrends.alertHeatmap` array from the backend
 * (only (weekday, hour) pairs that had at least one alert) - missing cells
 * are rendered as a real, honest zero rather than omitted from the grid.
 */
export function AlertHeatmap({ cells }) {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const cell of cells) {
    grid[cell.weekday][cell.hour] = cell.count;
  }
  const max = Math.max(1, ...cells.map((c) => c.count));

  if (cells.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        No alerts in this window yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="mb-1 grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[3px]">
          <div />
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="text-center font-mono text-[9px] text-muted-foreground">
              {i % 3 === 0 ? i : ""}
            </div>
          ))}
        </div>
        {grid.map((row, r) => (
          <div
            key={DAYS[r]}
            className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] items-center gap-[3px]"
          >
            <div className="text-right font-mono text-[10px] text-muted-foreground">{DAYS[r]}</div>
            {row.map((count, hour) => {
              const alpha = count === 0 ? 0.06 : Math.max(0.15, count / max);
              return (
                <div
                  key={hour}
                  title={`${DAYS[r]} ${hour}:00 — ${count} alert${count === 1 ? "" : "s"}`}
                  className="h-6 rounded-[3px] border border-primary/10"
                  style={{
                    background: `color-mix(in oklch, var(--color-primary) ${alpha * 100}%, transparent)`,
                  }}
                />
              );
            })}
          </div>
        ))}
        <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Low</span>
          <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-primary/10 via-primary/50 to-primary" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
