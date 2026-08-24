import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  ALERTS_BY_DAY,
  ALERTS_BY_HOUR,
  SEVERITY_DIST,
  ALERT_TYPES_DIST,
  NOTIF_SUCCESS,
} from "./mockData";
const AXIS = { stroke: "var(--color-muted-foreground)", fontSize: 10 };
const GRID = "var(--color-border)";
const TOOLTIP = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 11,
  },
  labelStyle: { color: "var(--color-muted-foreground)" },
};
function ChartCard({ title, subtitle, children, height = 220 }) {
  return (
    <Card className="glass-panel border-border/50 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="font-display text-sm font-semibold">{title}</div>
          {subtitle && (
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ height }}>{children}</div>
    </Card>
  );
}
export function AlertAnalytics() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Alerts by Day" subtitle="Last 14 days">
        <ResponsiveContainer>
          <BarChart data={ALERTS_BY_DAY}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="day" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Alerts by Hour" subtitle="24-hour distribution">
        <ResponsiveContainer>
          <LineChart data={ALERTS_BY_HOUR}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="h" {...AXIS} interval={2} />
            <YAxis {...AXIS} />
            <Tooltip {...TOOLTIP} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="oklch(0.78 0.16 55)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Severity Distribution" subtitle="Weighted mix">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={SEVERITY_DIST}
              dataKey="value"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={4}
            >
              {SEVERITY_DIST.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP} itemStyle={{ color: "var(--color-foreground)" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          {SEVERITY_DIST.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.name}
            </span>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Top Alert Types" subtitle="This week">
        <ResponsiveContainer>
          <BarChart data={ALERT_TYPES_DIST} layout="vertical">
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis type="number" {...AXIS} />
            <YAxis dataKey="name" type="category" {...AXIS} width={80} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="value" fill="var(--color-signal-drowsy)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Notification Success Rate" subtitle="Per channel">
        <ResponsiveContainer>
          <RadialBarChart
            innerRadius="30%"
            outerRadius="100%"
            data={NOTIF_SUCCESS}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar background dataKey="rate" cornerRadius={6} fill="var(--color-primary)" />
            <Tooltip {...TOOLTIP} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          {NOTIF_SUCCESS.map((n) => (
            <span key={n.channel} className="flex items-center justify-between">
              <span>{n.channel}</span>
              <span className="font-mono text-primary">{n.rate}%</span>
            </span>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Response & Recovery" subtitle="Seconds">
        <div className="grid h-full grid-cols-2 gap-3">
          <StatBig label="Avg Response" value="14.6s" tone="primary" />
          <StatBig label="Avg Recovery" value="42s" tone="warning" />
          <StatBig label="P95 Response" value="28s" tone="info" />
          <StatBig label="Escalation Rate" value="6.2%" tone="danger" />
        </div>
      </ChartCard>
    </div>
  );
}
function StatBig({ label, value, tone }) {
  const TONE = {
    primary: "border-primary/30 text-primary",
    warning: "border-amber-400/30 text-amber-300",
    info: "border-sky-400/30 text-sky-300",
    danger: "border-red-500/30 text-red-400",
  };
  return (
    <div
      className={`flex flex-col justify-center rounded-xl border bg-background/40 p-3 ${TONE[tone]}`}
    >
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </div>
  );
}
