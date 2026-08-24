import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Palette, Bell, LayoutDashboard, Camera, Languages } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
function Section({ icon: Icon, title, desc, children }) {
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="font-display text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className="space-y-2.5">{children}</div>
    </Card>
  );
}
function Toggle({ id, label, hint, defaultChecked }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-3">
      <div>
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch id={id} defaultChecked={defaultChecked} />
    </div>
  );
}
function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
export function PreferenceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section icon={Palette} title="Appearance" desc="Theme, accent, density.">
        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Theme
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="Dark" active={theme === "dark"} onClick={() => setTheme("dark")} />
            <Chip label="Light" active={theme === "light"} onClick={() => setTheme("light")} />
            <Chip label="Auto" active={theme === "system"} onClick={() => setTheme("system")} />
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Accent
          </div>
          <div className="flex flex-wrap gap-2">
            {["Teal", "Cyan", "Amber", "Violet", "Rose"].map((c, i) => (
              <Chip key={c} label={c} active={i === 0} />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Density
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="Compact" />
            <Chip label="Comfortable" active />
            <Chip label="Spacious" />
          </div>
        </div>
      </Section>

      <Section icon={Bell} title="Notifications" desc="How you want to be alerted.">
        <Toggle
          id="email"
          label="Email alerts"
          hint="Session summaries and critical alerts."
          defaultChecked
        />
        <Toggle id="wa" label="WhatsApp alerts" hint="Only for critical severity." defaultChecked />
        <Toggle id="sound" label="Sound notifications" hint="Cockpit chime on new alerts." />
        <Toggle id="digest" label="Daily digest" hint="8:00 AM local time." defaultChecked />
      </Section>

      <Section icon={LayoutDashboard} title="Dashboard" desc="Default landing and widgets.">
        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Landing page
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="Dashboard" active />
            <Chip label="Monitoring" />
            <Chip label="Alerts" />
            <Chip label="Reports" />
          </div>
        </div>
        <Toggle id="favw" label="Show favorite widgets" defaultChecked />
        <Toggle id="recent" label="Show recent items" defaultChecked />
      </Section>

      <Section icon={Camera} title="Monitoring" desc="Camera and detection defaults.">
        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Default camera
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="Cabin Cam · A10G-01" active />
            <Chip label="Cabin Cam · A10G-02" />
            <Chip label="Webcam" />
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Detection mode
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="Balanced" active />
            <Chip label="High precision" />
            <Chip label="High recall" />
          </div>
        </div>
      </Section>

      <Section icon={Languages} title="Language" desc="Interface language.">
        <div className="flex flex-wrap gap-2">
          <Chip label="English" active />
          <Chip label="العربية" />
          <Chip label="Français" />
          <Chip label="Deutsch" />
        </div>
      </Section>
    </div>
  );
}
