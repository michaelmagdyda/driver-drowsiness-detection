import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Eye, ArrowUpRight } from "lucide-react";
import { ERROR_LIST } from "@/components/errors/config";
export const Route = createFileRoute("/errors/")({
  head: () => ({
    meta: [
      { title: "Error & Maintenance Gallery · DriveAlert" },
      {
        name: "description",
        content:
          "Preview every DriveAlert exceptional state — 4xx and 5xx errors, offline modes, model states, camera issues, and maintenance windows.",
      },
      { property: "og:title", content: "Error & Maintenance Gallery · DriveAlert" },
      { property: "og:description", content: "Preview every DriveAlert exceptional state." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ErrorGallery,
});
const toneClass = {
  primary: "border-primary/40 text-primary",
  warning: "border-signal-drowsy/40 text-signal-drowsy",
  danger: "border-signal-danger/40 text-signal-danger",
  info: "border-border/60 text-foreground",
};
function ErrorGallery() {
  return (
    <div className="relative min-h-screen bg-cockpit px-6 py-16 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/4 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex items-start justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
                <Eye className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                DriveAlert · Error Suite
              </span>
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Error &amp; maintenance gallery
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Every exceptional state in the platform — polished, on-brand, and ready to reassure
              operators. Click any card to preview.
            </p>
          </div>
          <Link
            to="/"
            className="hidden shrink-0 rounded-lg border border-border/60 bg-card/50 px-4 py-2 text-xs text-muted-foreground backdrop-blur hover:text-foreground sm:block"
          >
            ← Back home
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ERROR_LIST.map((e, i) => {
            const Icon = e.icon;
            return (
              <motion.div
                key={e.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to="/errors/$slug"
                  params={{ slug: e.slug }}
                  className="group flex h-full flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-card/80"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-background/40 ${toneClass[e.tone]}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <div className="mt-4 text-metric text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {e.code}
                  </div>
                  <div className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground">
                    {e.title}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                    {e.description}
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
