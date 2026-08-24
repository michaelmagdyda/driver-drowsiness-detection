import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
const STATS = [
  { value: 98.4, suffix: "%", label: "Detection accuracy" },
  { value: 30, suffix: " FPS", label: "Real-time inference" },
  { value: 3, suffix: "×", label: "Supported inputs" },
  { value: 4, suffix: "", label: "Alert channels" },
  { value: 120, suffix: " ms", label: "Detection speed" },
];
export function Stats() {
  return (
    <section className="relative border-t border-border/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STATS.map((s, i) => (
            <StatCard key={s.label} {...s} delay={i * 0.08} />
          ))}
        </div>
      </div>
    </section>
  );
}
function StatCard({ value, suffix, label, delay }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  const formatted = Number.isInteger(value) ? Math.round(n).toString() : n.toFixed(1);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-xl"
    >
      <div className="text-metric text-4xl font-semibold text-primary md:text-5xl">
        {formatted}
        <span className="text-2xl text-primary/80">{suffix}</span>
      </div>
      <div className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </motion.div>
  );
}
