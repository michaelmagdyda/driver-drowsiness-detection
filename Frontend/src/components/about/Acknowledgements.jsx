import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { acknowledgements } from "./data";
import { SectionShell } from "./SectionShell";
export function Acknowledgements() {
  return (
    <SectionShell
      id="acknowledgements"
      eyebrow="Acknowledgements"
      title="Standing on generous shoulders."
      intro="This project would not exist without the guidance, teaching, and open-source community around us."
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {acknowledgements.map((a, i) => (
          <motion.div
            key={a.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className="glass-panel rounded-2xl border border-border/50 p-5"
          >
            <div className="flex items-center gap-2 text-primary">
              <Heart className="h-4 w-4" />
              <span className="font-display text-sm font-semibold">{a.title}</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{a.body}</div>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  );
}
