import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";

export const ALERT_SEVERITY_OPTIONS = [
  { value: "all", label: "All severities" },
  { value: "WARNING", label: "Warning" },
  { value: "DANGER", label: "Danger" },
  { value: "EMERGENCY", label: "Emergency" },
];

/**
 * Filters the Alert Analytics charts by real alert severity. The only
 * dimension here that maps to a real column (`detection_events.alert_level`)
 * - date range is already controlled by the page's own range selector, and
 * there is no vehicle/camera/driver-roster concept in this app's data model.
 */
export function FilterPanel({ severity, onSeverityChange }) {
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 text-primary" />
        <span className="font-display text-sm font-semibold">Alert Analytics Filter</span>
      </div>

      <div className="max-w-xs space-y-1.5">
        <Label className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Severity
        </Label>
        <Select value={severity} onValueChange={onSeverityChange}>
          <SelectTrigger className="h-9 border-border/60 bg-card/50 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALERT_SEVERITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
