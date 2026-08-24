import { Eye, Github, Mail } from "lucide-react";
const COLS = [
  {
    title: "Project",
    links: ["Overview", "Features", "Roadmap", "Changelog"],
  },
  {
    title: "Team",
    links: ["About us", "Advisors", "Contributions", "Acknowledgements"],
  },
  {
    title: "Technologies",
    links: ["PyTorch", "YOLO", "FastAPI", "Supabase"],
  },
];
export function Footer() {
  return (
    <footer
      id="contact"
      className="relative border-t border-border/60 bg-background/60 py-16 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
                <Eye className="h-4 w-4 text-primary" />
              </div>
              <span className="font-display text-lg font-semibold tracking-tight">DriveAlert</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              An AI-based driver drowsiness detection system. Built as a graduation project —
              engineered for the road ahead.
            </p>

            <div className="mt-6 flex items-center gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="mailto:team@drivealert.app"
                aria-label="Email"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {COLS.map((c) => (
            <div key={c.title}>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                {c.title}
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="transition-colors hover:text-foreground">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <div>
            © {new Date().getFullYear()} DriveAlert · Graduation Project. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
            <a href="mailto:team@drivealert.app" className="hover:text-foreground">
              team@drivealert.app
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
