import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
export const DEFAULT_FILTERS = {
  type: "all",
  status: "all",
  driverState: "all",
  severity: "all",
};
export function FilterPanel({ value, onChange, query, onQueryChange }) {
  const [open, setOpen] = useState(true);
  const set = (k, v) => onChange({ ...value, [k]: v });
  const activeCount = Object.values(value).filter((v) => v !== "all").length;
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <Filter className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <div className="font-display text-sm font-semibold">Filters</div>
            <div className="text-[11px] text-muted-foreground">
              {activeCount > 0
                ? `${activeCount} filter${activeCount > 1 ? "s" : ""} active`
                : "No filters applied"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(DEFAULT_FILTERS);
              onQueryChange?.("");
            }}
          >
            <RotateCcw className="mr-1.5 h-3 w-3" /> Reset
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Session Type">
            <Select value={value.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="webcam">Webcam</SelectItem>
                <SelectItem value="dashcam">Dashcam</SelectItem>
                <SelectItem value="video">Video Upload</SelectItem>
                <SelectItem value="image">Image Analysis</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={value.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Driver State">
            <Select value={value.driverState} onValueChange={(v) => set("driverState", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="AWAKE">Awake</SelectItem>
                <SelectItem value="YAWNING">Yawning</SelectItem>
                <SelectItem value="DROWSY">Drowsy</SelectItem>
                <SelectItem value="SLEEPING">Sleeping</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Alert Severity">
            <Select value={value.severity} onValueChange={(v) => set("severity", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="SAFE">Safe</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="DANGER">Danger</SelectItem>
                <SelectItem value="EMERGENCY">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Search">
              <Input
                value={query ?? ""}
                onChange={(e) => onQueryChange?.(e.target.value)}
                placeholder="Session ID…"
                className="bg-background/40"
              />
            </Field>
          </div>
        </div>
      )}
    </Card>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <Label className="mb-2 block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
