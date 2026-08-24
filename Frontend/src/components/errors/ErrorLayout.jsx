import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorIllustration } from "./ErrorIllustration";
import { ActionButtons } from "./ActionButtons";
import { HelpPanel } from "./HelpPanel";
import { StatusWidget } from "./StatusWidget";
import { ProgressCard } from "./ProgressCard";
import { SupportCard } from "./SupportCard";
function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 shadow-[0_0_20px_-4px_var(--color-primary)]">
            <Eye className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-display text-sm font-semibold tracking-tight">DriveAlert</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Cockpit OS
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden gap-6 text-xs text-muted-foreground md:flex">
            <Link to="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link to="/monitoring" className="hover:text-foreground">
              Monitoring
            </Link>
            <Link to="/reports" className="hover:text-foreground">
              Reports
            </Link>
            <Link to="/about" className="hover:text-foreground">
              About
            </Link>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background/40 py-6 text-center text-[11px] text-muted-foreground">
      © {new Date().getFullYear()} DriveAlert · AI Driver Safety Platform
    </footer>
  );
}
export function ErrorLayout({ config, children, showChrome = true }) {
  const Icon = config.icon;
  return (
    <div className="relative flex min-h-screen flex-col bg-cockpit text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-signal-danger/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {showChrome && <TopBar />}

      <main className="flex-1 px-6 py-10 lg:py-16">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-border/60 bg-card/60 p-8 backdrop-blur-xl sm:p-12"
          >
            <div className="pb-4 pt-6 text-center">
              <ErrorIllustration icon={Icon} tone={config.tone} code={config.code} />
            </div>

            <div className="mt-10 text-center">
              <div className="text-metric text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {config.eyebrow}
              </div>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {config.title}
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {config.description}
              </p>
            </div>

            <ActionButtons actions={config.actions} />

            {config.extras && config.extras.length > 0 && (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {config.extras.map((e, i) => {
                  if (e.kind === "status") return <StatusWidget key={i} items={e.items} />;
                  if (e.kind === "progress")
                    return <ProgressCard key={i} label={e.label} value={e.value} hint={e.hint} />;
                  if (e.kind === "meta")
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur"
                      >
                        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          Diagnostics
                        </div>
                        <dl className="grid grid-cols-2 gap-3 text-xs">
                          {e.items.map((m) => (
                            <div key={m.label}>
                              <dt className="text-muted-foreground">{m.label}</dt>
                              <dd className="mt-0.5 text-metric font-medium text-foreground">
                                {m.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  if (e.kind === "links")
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur sm:col-span-2"
                      >
                        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          Quick links
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {e.items.map((l) => (
                            <Link
                              key={l.to}
                              to={l.to}
                              className="rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-center text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
                            >
                              {l.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  if (e.kind === "reasons")
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur sm:col-span-2"
                      >
                        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          Possible reasons
                        </div>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {e.items.map((r, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs text-muted-foreground"
                            >
                              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-signal-drowsy" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  return null;
                })}
              </div>
            )}

            {config.tips && <HelpPanel tips={config.tips} />}

            {children}
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col gap-4"
          >
            <SupportCard />
            <StatusWidget
              title="Platform services"
              items={[
                { label: "Frontend", state: "ok" },
                { label: "Backend API", state: "ok" },
                { label: "Database", state: "ok" },
                { label: "Storage", state: "ok" },
                { label: "AI Engine", state: "ok" },
                { label: "Notifications", state: "warn", value: "Degraded" },
                { label: "WebSocket", state: "ok" },
                { label: "Camera Bridge", state: "ok" },
              ]}
            />
            <div className="rounded-xl border border-border/60 bg-card/50 p-4 text-xs text-muted-foreground backdrop-blur">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Support
              </div>
              <div>
                Email <span className="text-foreground">support@drivealert.io</span>
              </div>
              <div className="mt-1">Response within 24h · 24/7 for enterprise</div>
            </div>
          </motion.aside>
        </div>
      </main>

      {showChrome && <Footer />}
    </div>
  );
}
