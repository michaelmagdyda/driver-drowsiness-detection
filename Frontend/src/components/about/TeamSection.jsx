import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { team } from "./data";
import { SectionShell } from "./SectionShell";
import { GraduationCap } from "lucide-react";
export function TeamSection() {
  return (
    <SectionShell
      id="team"
      eyebrow="Team"
      title="The people behind DriveAlert."
      intro="Four engineers, one supervisor, one teaching assistant — united by a mission for safer roads."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((m, i) => {
          const isFaculty = m.role.includes("Supervisor") || m.role.includes("Teaching");
          return (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="glass-panel group relative overflow-hidden rounded-2xl border border-border/50 p-6 text-center transition hover:border-primary/40"
            >
              {isFaculty && (
                <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-300">
                  <GraduationCap className="h-3 w-3" /> Faculty
                </div>
              )}
              <Avatar className="mx-auto h-20 w-20 border-2 border-primary/40 shadow-[0_0_30px_-8px_var(--color-primary)]">
                <AvatarFallback className="bg-primary/10 font-display text-lg text-primary">
                  {m.initials}
                </AvatarFallback>
              </Avatar>
              <div className="mt-4 font-display text-base font-semibold">{m.name}</div>
              <div className="text-xs text-primary">{m.role}</div>
              <div className="mt-2 text-[11px] text-muted-foreground">{m.bio}</div>
            </motion.div>
          );
        })}
      </div>
    </SectionShell>
  );
}
