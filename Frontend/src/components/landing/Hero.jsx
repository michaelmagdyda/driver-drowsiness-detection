import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, PlayCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-cockpit.jpg";
export function Hero() {
  return (
    <section
      id="home"
      className="relative isolate flex min-h-screen items-center overflow-hidden pt-28"
    >
      {/* Animated backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-cockpit" />
        <motion.div
          initial={{ opacity: 0.4, scale: 1 }}
          animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.05, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-24 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,var(--color-background))] " />
        {/* grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
        />
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 pb-24 lg:grid-cols-[1.05fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" />
            AI Driver Safety · Graduation Project 2026
          </div>

          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            See fatigue
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-chart-2 bg-clip-text text-transparent">
              before it strikes.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            DriveAlert is a real-time driver drowsiness detection platform. Vision-grade AI reads
            eye closure, yawning and head pose — and raises decisive alerts the instant safety
            drops.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-sm">
              <Link to="/auth">
                <PlayCircle className="mr-2 h-4 w-4" /> Start demo
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-border/70 bg-background/40 px-6 text-sm backdrop-blur hover:bg-background/70"
            >
              <a href="#features">
                Learn more <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-8 text-xs text-muted-foreground">
            <TrustItem k="98.4%" v="Detection accuracy" />
            <TrustItem k="30 FPS" v="Real-time inference" />
            <TrustItem k="<120 ms" v="Alert latency" />
          </div>
        </motion.div>

        {/* Cockpit visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <img
              src={heroImg}
              alt="Automotive HUD cockpit"
              width={1600}
              height={1200}
              className="h-auto w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />

            {/* Floating HUD panels */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute left-5 top-5 rounded-xl border border-primary/30 bg-background/60 px-3 py-2 backdrop-blur-xl"
            >
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Live · Awake
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="absolute bottom-5 right-5 grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-background/70 p-3 backdrop-blur-xl"
            >
              <MiniStat k="EAR" v="0.31" />
              <MiniStat k="MAR" v="0.18" />
              <MiniStat k="FATIGUE" v="0.12" />
            </motion.div>
          </div>

          {/* glow */}
          <div className="absolute -inset-8 -z-10 rounded-[2rem] bg-primary/20 opacity-30 blur-3xl" />
        </motion.div>
      </div>
    </section>
  );
}
function TrustItem({ k, v }) {
  return (
    <div>
      <div className="text-metric text-lg font-semibold text-foreground">{k}</div>
      <div className="mt-0.5 uppercase tracking-widest">{v}</div>
    </div>
  );
}
function MiniStat({ k, v }) {
  return (
    <div className="min-w-[68px] rounded-lg bg-background/70 px-2.5 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {k}
      </div>
      <div className="text-metric text-sm font-semibold text-primary">{v}</div>
    </div>
  );
}
