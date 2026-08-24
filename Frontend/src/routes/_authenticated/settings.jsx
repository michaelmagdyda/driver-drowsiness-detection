import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  ChevronRight,
  Settings2,
  User,
  Palette,
  BrainCircuit,
  Radio,
  Bell,
  FileText,
  HardDrive,
  ShieldCheck,
  Plug,
  Code2,
  FlaskConical,
  Info,
  Camera,
  KeyRound,
  History,
  Send,
  Download,
  Upload,
  Zap,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  listModelCheckpoints,
  activateModelCheckpoint,
  getActiveModel,
  setConfidenceThreshold,
  setComputeDevice,
  ApiError,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { SaveBar, SavedIndicator } from "@/components/settings/SaveBar";
import {
  SettingsSection,
  ToggleCard,
  InputCard,
  SelectCard,
  SliderControl,
  DangerRow,
  LinkRow,
} from "@/components/settings/controls";
import { IntegrationsGrid } from "@/components/settings/IntegrationsGrid";
import { StoragePanel } from "@/components/settings/StoragePanel";
import { CATEGORIES, SYSTEM_INFO } from "@/components/settings/data";
import { useTheme } from "@/components/theme-provider";
export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings Center — DriveAlert" },
      {
        name: "description",
        content:
          "Configure AI thresholds, monitoring, notifications, integrations, and platform behavior.",
      },
      { property: "og:title", content: "Settings Center — DriveAlert" },
      {
        property: "og:description",
        content: "Enterprise configuration hub for the DriveAlert monitoring platform.",
      },
    ],
  }),
  component: SettingsPage,
});
function SettingsPage() {
  const [active, setActive] = useState("general");
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const filtered = useMemo(() => {
    if (!query) return CATEGORIES;
    return CATEGORIES.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  }, [query]);
  // If searching narrows out the active one, pick first match
  const activeId = filtered.some((c) => c.id === active) ? active : (filtered[0]?.id ?? active);
  const activeCat = CATEGORIES.find((c) => c.id === activeId);
  return (
    <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Cockpit</span>
            <ChevronRight className="h-3 w-3" />
            <span>Account</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Settings</span>
          </div>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Settings Center
            <SavedIndicator />
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Configure detection thresholds, notifications, integrations and platform behavior across
            your fleet.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings…"
            className="h-10 border-border/60 bg-card/60 pl-8 text-sm backdrop-blur"
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <SettingsSidebar active={activeId} onSelect={setActive} />

        <div onChangeCapture={() => setDirty(true)}>
          <Card className="glass-panel border-border/50 p-5 md:p-7">
            {activeCat?.id === "general" && <GeneralSection />}
            {activeCat?.id === "profile" && <ProfileSection />}
            {activeCat?.id === "appearance" && <AppearanceSection />}
            {activeCat?.id === "ai" && <AISection />}
            {activeCat?.id === "monitoring" && <MonitoringSection />}
            {activeCat?.id === "notifications" && <NotificationsSection />}
            {activeCat?.id === "reports" && <ReportsSection />}
            {activeCat?.id === "storage" && <StorageSection />}
            {activeCat?.id === "security" && <SecuritySection />}
            {activeCat?.id === "integrations" && <IntegrationsSection />}
            {activeCat?.id === "api" && <ApiSection />}
            {activeCat?.id === "advanced" && <AdvancedSection />}
            {activeCat?.id === "about" && <AboutSection />}
          </Card>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        onSave={() => setDirty(false)}
        onReset={() => setDirty(false)}
        onDiscard={() => setDirty(false)}
      />
    </div>
  );
}
/* ================= SECTIONS ================= */
function Grid({ children, cols = 2 }) {
  return (
    <div className={`grid gap-3 md:grid-cols-2 ${cols === 3 ? "xl:grid-cols-3" : ""}`}>
      {children}
    </div>
  );
}
function GeneralSection() {
  return (
    <SettingsSection
      icon={Settings2}
      title="General"
      subtitle="Workspace-wide defaults for your fleet."
    >
      <Grid cols={3}>
        <InputCard label="System Name" defaultValue="DriveAlert Cockpit" />
        <InputCard label="Organization" defaultValue="Aurora Fleet Ltd." />
        <SelectCard
          label="Default Language"
          options={["English (US)", "Français", "Deutsch", "العربية", "日本語"]}
        />
        <SelectCard
          label="Time Zone"
          options={["UTC", "Europe/Paris", "America/New_York", "Asia/Tokyo"]}
        />
        <SelectCard label="Date Format" options={["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]} />
        <InputCard label="Session Timeout" defaultValue="30" suffix="minutes" type="number" />
      </Grid>
      <ToggleCard
        label="Auto Save"
        description="Persist changes automatically as you edit."
        defaultChecked
      />
    </SettingsSection>
  );
}
function ProfileSection() {
  return (
    <SettingsSection icon={User} title="User Profile" subtitle="Your identity across the cockpit.">
      <Card className="glass-panel flex items-center gap-4 border-border/50 p-5">
        <Avatar className="h-16 w-16 border border-primary/30">
          <AvatarFallback className="bg-primary/10 text-lg text-primary">AD</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="font-display text-lg font-semibold">Alex Duarte</div>
          <div className="text-xs text-muted-foreground">
            Fleet Safety Administrator · admin@drivealert.io
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Upload photo
        </Button>
      </Card>
      <Grid cols={2}>
        <InputCard label="Full Name" defaultValue="Alex Duarte" />
        <InputCard label="Email" defaultValue="admin@drivealert.io" type="email" />
        <InputCard label="Phone Number" defaultValue="+33 6 12 34 56 78" type="tel" />
        <InputCard label="Job Title" defaultValue="Fleet Safety Administrator" />
        <InputCard label="Organization" defaultValue="Aurora Fleet Ltd." />
        <InputCard label="Password" defaultValue="••••••••" type="password" />
      </Grid>
      <LinkRow
        label="Two-Factor Authentication"
        description="Add an authenticator app or hardware key."
        badge="Coming Soon"
        disabled
      />
      <LinkRow
        label="Login History"
        description="Review recent sign-ins and device fingerprints."
      />
    </SettingsSection>
  );
}
function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const themes = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "system", label: "System" },
  ];
  const accents = [
    { name: "Cyan", color: "var(--color-primary)", active: true },
    { name: "Amber", color: "var(--color-signal-drowsy)" },
    { name: "Violet", color: "oklch(0.68 0.18 300)" },
    { name: "Crimson", color: "var(--color-signal-danger)" },
    { name: "Emerald", color: "oklch(0.72 0.16 155)" },
  ];
  return (
    <SettingsSection
      icon={Palette}
      title="Appearance"
      subtitle="Personalize the cockpit look and feel."
    >
      <Card className="glass-panel border-border/50 p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Theme</div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {themes.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`rounded-xl border p-4 text-left transition-all ${
                theme === value
                  ? "border-primary/40 bg-primary/[0.06]"
                  : "border-border/50 bg-background/40 hover:border-primary/30"
              }`}
            >
              <div className="mb-3 h-14 rounded-lg border border-border/60 bg-gradient-to-br from-background via-muted/20 to-primary/10" />
              <div className="text-sm font-medium">{label}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="glass-panel border-border/50 p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Accent Color</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {accents.map((a) => (
            <button
              key={a.name}
              className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all ${a.active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 hover:border-primary/40"}`}
            >
              <span
                className="h-3 w-3 rounded-full shadow-[0_0_10px_currentColor]"
                style={{ background: a.color, color: a.color }}
              />
              {a.name}
            </button>
          ))}
        </div>
      </Card>

      <Grid cols={2}>
        <SliderControl label="Font Size" min={12} max={18} defaultValue={14} suffix="px" />
        <SelectCard label="Sidebar Style" options={["Rail", "Expanded", "Floating"]} />
        <SelectCard label="Animation Level" options={["Full", "Reduced", "None"]} />
        <ToggleCard label="Compact Mode" description="Denser layout with tighter padding." />
      </Grid>
    </SettingsSection>
  );
}
function AISection() {
  const [status, setStatus] = useState("loading"); // loading | done | error
  const [error, setError] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [active, setActive] = useState(null); // { architecture, device, numClasses, scoreThreshold }
  const [switching, setSwitching] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [switchingDevice, setSwitchingDevice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([listModelCheckpoints(), getActiveModel()])
      .then(([checkpointList, activeModel]) => {
        if (cancelled) return;
        setCheckpoints(checkpointList);
        setActive(activeModel);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load the AI model state.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCheckpoint = checkpoints.find((c) => c.active);

  const handleActivate = async (id) => {
    setSwitching(true);
    try {
      const refreshed = await activateModelCheckpoint(id);
      setCheckpoints(refreshed);
      // Activating a checkpoint rebuilds it at the server's configured
      // default threshold, not whatever this panel last set - refetch so
      // the threshold slider reflects what's actually running.
      const activeModel = await getActiveModel();
      setActive(activeModel);
      toast.success("Active model switched.", { description: id });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to switch the active model.");
    } finally {
      setSwitching(false);
    }
  };

  const handleThresholdCommit = async (percent) => {
    setSavingThreshold(true);
    try {
      const updated = await setConfidenceThreshold(percent / 100);
      setActive(updated);
      toast.success("Confidence threshold updated.", { description: `${percent}%` });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update the threshold.");
      // The optimistic drag left the slider showing an unconfirmed value -
      // refetch so it snaps back to whatever is actually running.
      try {
        setActive(await getActiveModel());
      } catch {
        // Best-effort revert; the error toast above already told the user.
      }
    } finally {
      setSavingThreshold(false);
    }
  };

  const handleDeviceChange = async (device) => {
    setSwitchingDevice(true);
    try {
      const updated = await setComputeDevice(device);
      setActive(updated);
      if (device === "gpu" && updated.device === "cpu") {
        toast.info("No GPU execution provider is available here — staying on CPU.");
      } else {
        toast.success("Compute backend updated.", { description: updated.device.toUpperCase() });
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to switch the compute backend.");
      try {
        setActive(await getActiveModel());
      } catch {
        // Best-effort revert; the error toast above already told the user.
      }
    } finally {
      setSwitchingDevice(false);
    }
  };

  if (status === "loading") {
    return (
      <SettingsSection icon={BrainCircuit} title="AI Detection" subtitle="Loading model state…">
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card/40 p-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading real checkpoints and active model…
        </div>
      </SettingsSection>
    );
  }

  if (status === "error") {
    return (
      <SettingsSection
        icon={BrainCircuit}
        title="AI Detection"
        subtitle="Could not load model state."
      >
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <div className="font-medium">Could not reach the AI model admin API</div>
            <div className="mt-0.5 text-xs text-destructive/80">{error}</div>
          </div>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      icon={BrainCircuit}
      title="AI Detection"
      subtitle="Real checkpoints and the live inference backend - not a mock. Changes apply immediately, in-memory, for every user."
    >
      <Grid cols={2}>
        <SelectCard
          label="Active AI Model"
          disabled={switching}
          value={activeCheckpoint?.id ?? ""}
          onChange={handleActivate}
          options={checkpoints.map((c) => ({
            value: c.id,
            label: c.compatible ? c.id : `${c.id} (incompatible)`,
          }))}
          description="Every .pth file under the configured checkpoints directory, each real-load-tested."
        />
        <InputCard
          label="Model Version"
          readOnly
          defaultValue={`${active.architecture} · ${active.numClasses} classes`}
        />
        <SelectCard
          label="Compute Backend"
          disabled={switchingDevice}
          value={active.device === "cpu" ? "cpu" : "gpu"}
          onChange={handleDeviceChange}
          options={[
            { value: "cpu", label: "CPU" },
            { value: "gpu", label: "GPU" },
          ]}
          description={`Running on ${active.device.toUpperCase()}. Changes apply immediately, in-memory.`}
        />
        <InputCard
          label="Inference FPS"
          readOnly
          defaultValue="Set per request"
          badge="Not global"
          description="Chosen per video analysis (sample rate), not a global setting."
        />
      </Grid>
      <SliderControl
        label="Confidence Threshold"
        min={0}
        max={100}
        value={Math.round(active.scoreThreshold * 100)}
        onValueCommit={handleThresholdCommit}
        disabled={savingThreshold}
        suffix="%"
        description="Minimum detector score to keep a box. Rebuilds the active checkpoint on release."
      />
      <div className="rounded-xl border border-border/50 bg-background/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> Not available in this build
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          This model detects <span className="font-mono">closed_eye</span>/
          <span className="font-mono">open_eye</span>/<span className="font-mono">yawn</span> boxes
          directly - there are no facial landmarks, so no real Eye/Mouth Aspect Ratio or head pose
          is ever computed, and the fatigue score is a fixed formula rather than a configurable
          threshold. The controls below are shown for reference only.
        </p>
        <Grid cols={3}>
          <SliderControl
            label="Fatigue Score Threshold"
            defaultValue={70}
            suffix="%"
            disabled
            badge="N/A"
          />
          <SliderControl
            label="Head Pose Threshold"
            min={0}
            max={45}
            defaultValue={20}
            suffix="°"
            disabled
            badge="N/A"
          />
          <SliderControl
            label="EAR Threshold"
            min={10}
            max={40}
            defaultValue={22}
            suffix="%"
            disabled
            badge="N/A"
          />
          <SliderControl
            label="MAR Threshold"
            min={30}
            max={90}
            defaultValue={55}
            suffix="%"
            disabled
            badge="N/A"
          />
          <SliderControl
            label="Eye Closure Duration"
            min={0.5}
            max={5}
            step={0.1}
            defaultValue={1.5}
            suffix="s"
            disabled
            badge="N/A"
          />
          <InputCard
            label="Yawning Count Threshold"
            defaultValue="4"
            suffix="per minute"
            readOnly
            badge="N/A"
          />
        </Grid>
      </div>
    </SettingsSection>
  );
}
function MonitoringSection() {
  return (
    <SettingsSection
      icon={Radio}
      title="Monitoring"
      subtitle="Camera capture and session behavior."
    >
      <Grid cols={2}>
        <SelectCard
          label="Default Camera"
          options={["Cockpit HD - A1", "IR Night Cam", "Dashcam 4K", "Rear-View DMS"]}
        />
        <SelectCard label="Video Resolution" options={["1920×1080", "1280×720", "854×480"]} />
        <SelectCard label="Frame Rate" options={["30 fps", "24 fps", "15 fps", "10 fps"]} />
        <SelectCard label="Recording Quality" options={["Ultra", "High", "Standard", "Eco"]} />
        <InputCard label="Snapshot Interval" defaultValue="10" suffix="seconds" type="number" />
        <InputCard label="Monitoring Timeout" defaultValue="4" suffix="hours" type="number" />
      </Grid>
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleCard
          label="Auto Start Monitoring"
          description="Begin capture when the cockpit page loads."
        />
        <ToggleCard
          label="Auto Save Sessions"
          description="Persist telemetry and clips to Storage automatically."
          defaultChecked
        />
      </div>
      <Card className="glass-panel flex items-center gap-3 border-border/50 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <Camera className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Camera diagnostics</div>
          <div className="text-xs text-muted-foreground">
            Run a 5-second capture test to validate resolution and framerate.
          </div>
        </div>
        <Button variant="outline" size="sm">
          Run test
        </Button>
      </Card>
    </SettingsSection>
  );
}
function NotificationsSection() {
  return (
    <SettingsSection
      icon={Bell}
      title="Notifications"
      subtitle="Delivery channels and escalation preferences."
      actions={
        <Button size="sm" className="gap-1.5">
          <Send className="h-3.5 w-3.5" /> Send test notification
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleCard
          label="Email Notifications"
          description="Digest and per-alert emails."
          defaultChecked
        />
        <ToggleCard
          label="WhatsApp Notifications"
          description="Real-time messages via Twilio."
          defaultChecked
        />
        <ToggleCard
          label="Sound Alarm"
          description="Play in-cockpit alarm on critical events."
          defaultChecked
        />
        <ToggleCard
          label="Browser Notifications"
          description="Native push in the cockpit tab."
          badge="Future"
          disabled
        />
        <ToggleCard
          label="SMS Notifications"
          description="Fallback channel for offline users."
          badge="Future"
          disabled
        />
      </div>
      <Grid cols={2}>
        <SliderControl label="Alarm Volume" defaultValue={70} suffix="%" />
        <InputCard label="Notification Delay" defaultValue="2" suffix="seconds" type="number" />
      </Grid>
      <LinkRow
        label="Escalation Rules"
        description="Route unacknowledged alerts to supervisors."
        badge="Future"
        disabled
      />
    </SettingsSection>
  );
}
function ReportsSection() {
  return (
    <SettingsSection
      icon={FileText}
      title="Reports"
      subtitle="Defaults applied when generating reports."
    >
      <Grid cols={2}>
        <SelectCard
          label="Default Template"
          options={[
            "Executive Summary",
            "Fleet Report",
            "Safety Report",
            "Daily Monitoring",
            "AI Performance",
          ]}
        />
        <SelectCard
          label="Default Export Format"
          options={["PDF", "CSV", "Excel", "JSON", "ZIP"]}
        />
        <InputCard label="PDF Branding · Header" defaultValue="DriveAlert · Fleet Safety" />
        <InputCard label="Company Logo URL" placeholder="https://…/logo.svg" />
      </Grid>
      <div className="grid gap-3 md:grid-cols-3">
        <ToggleCard label="Include Charts" defaultChecked />
        <ToggleCard label="Include Screenshots" defaultChecked />
        <ToggleCard label="Automatic Generation" description="Weekly on Monday 08:00" />
      </div>
    </SettingsSection>
  );
}
function StorageSection() {
  return (
    <SettingsSection
      icon={HardDrive}
      title="Storage"
      subtitle="Session media, reports, and cache footprint."
    >
      <StoragePanel />
    </SettingsSection>
  );
}
function SecuritySection() {
  return (
    <SettingsSection
      icon={ShieldCheck}
      title="Security"
      subtitle="Access control and audit trails."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <LinkRow label="Change Password" description="Rotate your account password." />
        <LinkRow
          label="Two-Factor Authentication"
          description="Authenticator app or WebAuthn key."
          badge="Coming Soon"
          disabled
        />
        <LinkRow label="Active Sessions" description="3 active devices · 1 pending revocation." />
        <LinkRow label="Login History" description="Last 90 days of sign-in events." />
        <LinkRow label="API Access" description="Personal access tokens and scopes." />
        <LinkRow label="Device Management" description="Trusted browsers and cockpit terminals." />
      </div>
      <Card className="glass-panel flex items-center gap-3 border-border/50 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <History className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Audit Logs</div>
          <div className="text-xs text-muted-foreground">
            Immutable record of every configuration change and admin action.
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </Card>
    </SettingsSection>
  );
}
function IntegrationsSection() {
  return (
    <SettingsSection
      icon={Plug}
      title="Integrations"
      subtitle="Connect DriveAlert to the rest of your stack."
    >
      <IntegrationsGrid />
    </SettingsSection>
  );
}
function ApiSection() {
  return (
    <SettingsSection
      icon={Code2}
      title="API Settings"
      subtitle="Read-only endpoints for developer integration."
    >
      <Grid cols={2}>
        <InputCard label="Backend URL" defaultValue="https://api.drivealert.io" readOnly />
        <InputCard label="API Version" defaultValue="v1.4" readOnly />
        <InputCard
          label="WebSocket Endpoint"
          defaultValue="wss://api.drivealert.io/ws/stream"
          readOnly
        />
        <InputCard label="API Health" defaultValue="● Operational · 99.98%" readOnly />
      </Grid>
      <Card className="glass-panel flex items-center gap-3 border-border/50 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">API Key Status</div>
          <div className="text-xs text-muted-foreground">
            Primary key issued 2026-06-14 · rotates every 90 days.
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
          <Zap className="h-3 w-3" /> Active
        </div>
      </Card>
    </SettingsSection>
  );
}
function AdvancedSection() {
  return (
    <SettingsSection
      icon={FlaskConical}
      title="Advanced"
      subtitle="Power-user controls and destructive actions."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleCard
          label="Debug Mode"
          description="Enable verbose UI overlays and telemetry panels."
        />
        <ToggleCard
          label="Enable Logging"
          description="Ship structured logs to the analytics database."
          defaultChecked
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <LinkRow label="Export Logs" description="Download the last 7 days of application logs." />
        <LinkRow
          label="Import Configuration"
          description="Restore settings from a signed export bundle."
        />
      </div>

      <div className="mt-2">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-400">
          <span className="h-px flex-1 bg-red-500/30" />
          Danger Zone
          <span className="h-px flex-1 bg-red-500/30" />
        </div>
        <div className="space-y-3">
          <DangerRow
            title="Reset Application"
            description="Clear UI preferences, cached telemetry, and local session state."
            action="Reset"
          />
          <DangerRow
            title="Factory Reset"
            description="Irreversibly delete all workspace data, sessions, and reports."
            action="Factory reset"
          />
        </div>
      </div>
    </SettingsSection>
  );
}
function AboutSection() {
  return (
    <SettingsSection
      icon={Info}
      title="About System"
      subtitle="Read-only build and licensing information."
    >
      <div className="grid gap-2 md:grid-cols-2">
        {SYSTEM_INFO.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-4"
          >
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {row.label}
            </div>
            <div className="font-mono text-sm font-semibold">{row.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Configuration changes will sync with the backend after integration is enabled.
      </p>
    </SettingsSection>
  );
}
