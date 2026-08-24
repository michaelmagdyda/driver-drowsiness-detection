import { motion } from "framer-motion";
export function SectionShell({ id, eyebrow, title, intro, children, tone = "default" }) {
  return (
    <section id={id} className={`relative py-20 md:py-28 ${tone === "muted" ? "bg-card/20" : ""}`}>
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-10 max-w-3xl md:mb-14"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {eyebrow}
          </div>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            {title}
          </h2>
          {intro && <p className="mt-4 text-base text-muted-foreground md:text-lg">{intro}</p>}
        </motion.div>

        {children}
      </div>
    </section>
  );
}
