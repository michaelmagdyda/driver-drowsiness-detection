import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
const AXIS = { stroke: "var(--color-muted-foreground)", fontSize: 10 };
const GRID = "var(--color-border)";
export function AnalyticsCharts({ trend, alertsPerMinute, distribution }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="EAR trend" subtitle="Eye aspect ratio over time">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="earFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="t" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="ear"
              stroke="var(--color-primary)"
              fill="url(#earFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="MAR trend" subtitle="Mouth aspect ratio — yawning spikes">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="marFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-signal-drowsy)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-signal-drowsy)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="t" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="mar"
              stroke="var(--color-signal-drowsy)"
              fill="url(#marFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Fatigue score" subtitle="0 = awake · 100 = severe">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trend}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="t" {...AXIS} />
            <YAxis {...AXIS} domain={[0, 100]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="fatigue"
              stroke="var(--color-signal-danger)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Confidence" subtitle="Detection confidence per second">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trend}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="t" {...AXIS} />
            <YAxis {...AXIS} domain={[0, 1]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="confidence"
              stroke="var(--color-chart-2)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Alert frequency" subtitle="Alerts per minute">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={alertsPerMinute}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="minute" {...AXIS} />
            <YAxis {...AXIS} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="alerts" fill="var(--color-signal-drowsy)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Detection distribution" subtitle="Event breakdown">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={distribution}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
              stroke="var(--color-background)"
            >
              {distribution.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--color-foreground)" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--color-foreground)",
};
function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl">
      <div className="mb-3">
        <div className="font-display text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}
