import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { monthlySessions, weeklyActivity } from "./mockData";
const axisStyle = {
  fontSize: 10,
  fontFamily: "JetBrains Mono, monospace",
  fill: "var(--color-muted-foreground)",
};
export function AccountCharts() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="glass-panel border-border/50 p-5">
        <div className="mb-3">
          <div className="font-display text-sm font-semibold">Monthly sessions & reports</div>
          <div className="text-xs text-muted-foreground">Trailing 12 months.</div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlySessions} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--color-muted-foreground)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="reports"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="glass-panel border-border/50 p-5">
        <div className="mb-3">
          <div className="font-display text-sm font-semibold">Weekly activity</div>
          <div className="text-xs text-muted-foreground">Logins vs uploads (this week).</div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyActivity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="logins" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="uploads" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
