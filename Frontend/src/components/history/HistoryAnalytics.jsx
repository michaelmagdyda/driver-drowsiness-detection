import { Card } from "@/components/ui/card";
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
import { MOCK_TRENDS } from "./mockData";
const AXIS = { stroke: "var(--color-muted-foreground)", fontSize: 10 };
const GRID = "var(--color-border)";
const TT = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 11,
    fontFamily: "JetBrains Mono, monospace",
  },
};
export function HistoryAnalytics() {
  const { sessionsPerDay, alertsPerWeek, fatigueTrend, distribution } = MOCK_TRENDS;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Sessions per Day" subtitle="Last 14 days">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={sessionsPerDay}>
            <defs>
              <linearGradient id="sess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TT} />
            <Area
              dataKey="sessions"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#sess)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Alerts per Week" subtitle="Rolling 8-week window">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={alertsPerWeek}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="week" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TT} />
            <Bar dataKey="alerts" fill="var(--color-signal-drowsy)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Alert Distribution" subtitle="Status breakdown">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={distribution}
              dataKey="value"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={4}
            >
              {distribution.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...TT} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Fatigue Trend" subtitle="24-hour composite">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={fatigueTrend}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="h" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TT} />
            <Line
              dataKey="fatigue"
              stroke="var(--color-signal-danger)"
              strokeWidth={2}
              dot={false}
            />
            <Line dataKey="confidence" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="EAR & MAR (avg)" subtitle="Eye/mouth aspect ratios">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={fatigueTrend}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="h" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TT} />
            <Line dataKey="ear" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            <Line dataKey="mar" stroke="var(--color-signal-drowsy)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Monitoring Duration" subtitle="Session lengths (min)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sessionsPerDay.map((d) => ({ ...d, dur: d.sessions * 6 + 20 }))}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TT} />
            <Bar dataKey="dur" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
function ChartCard({ title, subtitle, children }) {
  return (
    <Card className="glass-panel border-border/50 p-4">
      <div className="mb-3">
        <div className="font-display text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      {children}
    </Card>
  );
}
