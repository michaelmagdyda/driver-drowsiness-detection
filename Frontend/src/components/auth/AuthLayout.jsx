import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Eye, ArrowLeft } from "lucide-react";
import authSide from "@/assets/auth-side.jpg";
import { ThemeToggle } from "@/components/theme-toggle";
export function AuthLayout({ title, subtitle, children, footer, backTo }) {
  return (
    <div className="relative flex min-h-screen bg-cockpit">
      {/* Left visual */}
      <aside className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <img
          src={authSide}
          alt=""
          aria-hidden
          loading="lazy"
          width={1200}
          height={1600}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/60 via-background/30 to-background/90" />
        <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2.5 text-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 backdrop-blur">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">DriveAlert</span>
          </Link>

          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Cockpit Access
            </div>
            <h2 className="mt-6 max-w-md font-display text-3xl font-semibold leading-tight text-foreground">
              A calm, precise safety copilot — engineered for the road ahead.
            </h2>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Sign in to monitor drivers in real time, review sessions, and command every alert from
              a single cockpit.
            </p>
          </div>
        </div>
      </aside>

      {/* Right form */}
      <main className="relative flex flex-1 flex-col px-6 py-10 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
              <Eye className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-display font-semibold text-foreground">DriveAlert</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {backTo && (
              <Link
                to={backTo.to}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {backTo.label}
              </Link>
            )}
            <ThemeToggle />
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center"
        >
          <div className="rounded-2xl border border-border/60 bg-card/70 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <p className="mt-6 text-center text-xs text-muted-foreground">{footer}</p>}
        </motion.div>

        <footer className="mt-8 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} DriveAlert · Secure by design
        </footer>
      </main>
    </div>
  );
}
