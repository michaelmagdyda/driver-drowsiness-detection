import { motion } from "framer-motion";
import { SectionHeader } from "./Features";
const STACK = [
  { name: "PyTorch", role: "Deep learning framework", accent: "#EE4C2C" },
  { name: "YOLO", role: "Object detection model", accent: "#00FFB3" },
  { name: "FastAPI", role: "Async Python backend", accent: "#009688" },
  { name: "OpenCV", role: "Computer vision toolkit", accent: "#5C3EE8" },
  { name: "React", role: "Frontend framework", accent: "#61DAFB" },
  { name: "TypeScript", role: "Type-safe UI code", accent: "#3178C6" },
  { name: "Supabase", role: "Auth · DB · Storage", accent: "#3ECF8E" },
  { name: "TailwindCSS", role: "Design system utility", accent: "#38BDF8" },
];
export function TechStack() {
  return (
    <section id="technology" className="relative border-t border-border/60 py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          kicker="Engineering"
          title="Built on the tools we trust."
          subtitle="Battle-tested open source. No black boxes."
        />

        <div className="mt-16 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {STACK.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl transition-colors hover:border-primary/40"
            >
              <div
                className="mb-4 h-1.5 w-10 rounded-full"
                style={{ backgroundColor: t.accent, boxShadow: `0 0 20px ${t.accent}66` }}
              />
              <div className="font-display text-lg font-semibold tracking-tight">{t.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t.role}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
