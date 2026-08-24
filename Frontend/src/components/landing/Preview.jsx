import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeader } from "./Features";
import previewLive from "@/assets/preview-live.jpg";
import previewAnalytics from "@/assets/preview-analytics.jpg";
const TABS = [
  { id: "live", label: "Live Monitoring", img: previewLive },
  { id: "analytics", label: "Analytics", img: previewAnalytics },
  { id: "history", label: "History", img: previewAnalytics },
  { id: "admin", label: "Admin Dashboard", img: previewLive },
];
export function Preview() {
  const [active, setActive] = useState(TABS[0].id);
  const current = TABS.find((t) => t.id === active) ?? TABS[0];
  return (
    <section id="preview" className="relative border-t border-border/60 py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          kicker="Product"
          title="A cockpit, not a dashboard."
          subtitle="Screens designed for calm attention — until the moment they can't be."
        />

        <div className="mt-14 flex flex-wrap justify-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                active === t.id
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative mt-10">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-2 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-signal-danger/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-signal-drowsy/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-signal-awake/80" />
              <span className="ml-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                drivealert.app / {current.id}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border/60">
              <AnimatePresence mode="wait">
                <motion.img
                  key={current.id}
                  src={current.img}
                  alt={current.label}
                  width={1400}
                  height={900}
                  loading="lazy"
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="block h-auto w-full"
                />
              </AnimatePresence>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
            </div>
          </div>
          <div className="absolute -inset-x-20 -bottom-10 -z-10 h-40 bg-primary/20 opacity-40 blur-3xl" />
        </div>
      </div>
    </section>
  );
}
