import { Eye, Github, Mail } from "lucide-react";
export function AboutFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/70 py-10 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-sm font-semibold">DriveAlert</div>
            <div className="text-[11px] text-muted-foreground">
              AI-Based Driver Drowsiness Detection · v0.9.0
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>License · MIT</span>
          <a href="#" className="inline-flex items-center gap-1.5 transition hover:text-foreground">
            <Github className="h-3.5 w-3.5" /> Repository
          </a>
          <a href="#" className="inline-flex items-center gap-1.5 transition hover:text-foreground">
            <Mail className="h-3.5 w-3.5" /> Contact
          </a>
        </div>

        <div className="text-[11px] text-muted-foreground">© 2026 DriveAlert Project Team</div>
      </div>
    </footer>
  );
}
