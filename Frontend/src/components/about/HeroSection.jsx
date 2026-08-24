import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react";
export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 500px at 20% 0%, color-mix(in oklch, var(--color-primary) 18%, transparent), transparent 60%), radial-gradient(900px 400px at 90% 10%, color-mix(in oklch, var(--color-chart-2) 15%, transparent), transparent 60%), linear-gradient(180deg, var(--color-background) 0%, var(--color-card) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-3 w-3" /> Graduation Project · 2026
          </span>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-6xl lg:text-7xl">
            AI-Based Driver
            <br />
            <span className="bg-gradient-to-r from-primary via-primary/80 to-sky-300 bg-clip-text text-transparent">
              Drowsiness Detection
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            A real-time cockpit intelligence platform that watches for fatigue before it becomes a
            crash. Built with deep learning, computer vision, and a production-grade full-stack.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <a href="#architecture">
                Explore architecture <ArrowRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="gap-2" asChild>
              <a href="#solution">
                <PlayCircle className="h-4 w-4" /> Watch demo
              </a>
            </Button>
          </div>

          <div className="mt-12 grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { k: "Detection", v: "Real-time" },
              { k: "Latency", v: "18 ms" },
              { k: "Models", v: "3 architectures" },
              { k: "Coverage", v: "24/7" },
            ].map((s, i) => (
              <motion.div
                key={s.k}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
                className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur"
              >
                <div className="font-mono text-lg font-semibold text-primary">{s.v}</div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {s.k}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
