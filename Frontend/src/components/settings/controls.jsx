import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
/* ---------- Section header ---------- */
export function SettingsSection({ icon: Icon, title, subtitle, children, actions }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="flex flex-col gap-1 border-b border-border/50 pb-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="space-y-3">{children}</div>
    </motion.section>
  );
}
/* ---------- Toggle card ---------- */
export function ToggleCard({ label, description, defaultChecked = false, badge, disabled }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <Card
      className={cn(
        "glass-panel flex items-center justify-between gap-4 border-border/50 p-4",
        disabled && "opacity-60",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{label}</div>
          {badge && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-primary">
              {badge}
            </span>
          )}
        </div>
        {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={on} onCheckedChange={setOn} disabled={disabled} />
    </Card>
  );
}
/* ---------- Input card ---------- */
export function InputCard({
  label,
  description,
  placeholder,
  defaultValue,
  suffix,
  type = "text",
  readOnly,
  badge,
}) {
  return (
    <Card className="glass-panel border-border/50 p-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
        {badge && (
          <span className="rounded-full border border-muted/60 bg-muted/20 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input
          type={type}
          placeholder={placeholder}
          defaultValue={defaultValue}
          readOnly={readOnly}
          className={cn(
            "h-10 border-border/60 bg-background/40 text-sm",
            readOnly && "cursor-default text-muted-foreground",
          )}
        />
        {suffix && (
          <span className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {description && <div className="mt-1.5 text-[11px] text-muted-foreground">{description}</div>}
    </Card>
  );
}
/* ---------- Select card ---------- */
// Options may be plain strings (uncontrolled sections) or {value, label} pairs
// (controlled sections, where the label shown differs from the value sent).
// `value`/`onChange` make this controlled - omit both for the original
// defaultValue-only, fire-and-forget behavior every other section still uses.
export function SelectCard({
  label,
  description,
  options,
  defaultValue,
  value,
  onChange,
  disabled,
  badge,
}) {
  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const controlProps =
    value !== undefined
      ? { value, onChange: (e) => onChange?.(e.target.value) }
      : { defaultValue: defaultValue ?? normalized[0]?.value };
  return (
    <Card className={cn("glass-panel border-border/50 p-4", disabled && "opacity-60")}>
      <div className="flex items-center gap-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
        {badge && (
          <span className="rounded-full border border-muted/60 bg-muted/20 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <select
        disabled={disabled}
        {...controlProps}
        className="mt-2 h-10 w-full rounded-md border border-border/60 bg-background/40 px-3 text-sm focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed"
      >
        {normalized.map((o) => (
          <option key={o.value} value={o.value} className="bg-background text-foreground">
            {o.label}
          </option>
        ))}
      </select>
      {description && <div className="mt-1.5 text-[11px] text-muted-foreground">{description}</div>}
    </Card>
  );
}
/* ---------- Slider card ---------- */
// `value`/`onValueCommit` make this controlled (committed only on release,
// so a real backend call fires once per drag rather than per pixel moved) -
// omit both for the original defaultValue-only, purely local behavior.
export function SliderControl({
  label,
  description,
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 50,
  suffix,
  value,
  onValueCommit,
  disabled,
  badge,
}) {
  const isControlled = value !== undefined;
  // Local state drives the visible thumb/label even when controlled, so
  // dragging is smooth; it's kept in sync with the prop (e.g. after the
  // parent refetches the server-confirmed value, or reverts on error).
  const [localVal, setLocalVal] = useState(value ?? defaultValue);
  useEffect(() => {
    if (isControlled) setLocalVal(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Card className={cn("glass-panel border-border/50 p-4", disabled && "opacity-60")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
          {badge && (
            <span className="rounded-full border border-muted/60 bg-muted/20 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        <span className="font-mono text-sm font-semibold text-primary">
          {localVal}
          {suffix ?? ""}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[localVal]}
        disabled={disabled}
        onValueChange={(v) => setLocalVal(v[0])}
        onValueCommit={isControlled ? (v) => onValueCommit?.(v[0]) : undefined}
        className="mt-3"
      />
      {description && <div className="mt-2 text-[11px] text-muted-foreground">{description}</div>}
    </Card>
  );
}
/* ---------- Danger row ---------- */
export function DangerRow({ title, description, action = "Delete", onClick }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-400"
      >
        {action}
      </Button>
    </div>
  );
}
/* ---------- Row link ---------- */
export function LinkRow({ label, description, badge, disabled }) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 p-4 text-left transition-all",
        !disabled && "hover:border-primary/40 hover:bg-primary/[0.04]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{label}</div>
          {badge && (
            <span className="rounded-full border border-muted/60 bg-muted/20 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}
