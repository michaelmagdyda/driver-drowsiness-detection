import { motion } from "framer-motion";
const stateStyles = {
  ok: {
    dot: "bg-primary shadow-[0_0_10px_var(--color-primary)]",
    text: "text-primary",
    label: "Online",
  },
  warn: {
    dot: "bg-signal-drowsy shadow-[0_0_10px_var(--color-signal-drowsy)]",
    text: "text-signal-drowsy",
    label: "Warning",
  },
  down: {
    dot: "bg-signal-danger shadow-[0_0_10px_var(--color-signal-danger)]",
    text: "text-signal-danger",
    label: "Offline",
  },
  maint: { dot: "bg-muted-foreground", text: "text-muted-foreground", label: "Maintenance" },
};
export function StatusWidget({ items, title = "System status" }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        <span>{title}</span>
        <span>Live</span>
      </div>
      <div className="grid gap-2">
        {items.map((s, i) => {
          const st = stateStyles[s.state];
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <motion.span
                  className={`h-2 w-2 rounded-full ${st.dot}`}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
                <span className="text-sm text-foreground">{s.label}</span>
              </div>
              <span className={`text-metric text-xs font-medium ${st.text}`}>
                {s.value ?? st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function GlobalStatusWidget() {
  const services = [
    { label: "Frontend", state: "ok" },
    { label: "Backend API", state: "ok" },
    { label: "Database", state: "ok" },
    { label: "Storage", state: "ok" },
    { label: "AI Engine", state: "ok" },
    { label: "Notifications", state: "warn", value: "Degraded" },
    { label: "WebSocket", state: "ok" },
    { label: "Camera Bridge", state: "ok" },
  ];
  return <StatusWidget items={services} title="Platform services" />;
}
