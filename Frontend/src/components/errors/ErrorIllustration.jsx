import { motion } from "framer-motion";
const toneRing = {
  primary:
    "border-primary/40 bg-primary/10 text-primary shadow-[0_0_60px_-10px_var(--color-primary)]",
  warning:
    "border-signal-drowsy/40 bg-signal-drowsy/10 text-signal-drowsy shadow-[0_0_60px_-10px_var(--color-signal-drowsy)]",
  danger:
    "border-signal-danger/40 bg-signal-danger/10 text-signal-danger shadow-[0_0_60px_-10px_var(--color-signal-danger)]",
  info: "border-border/60 bg-card/60 text-foreground shadow-[0_0_60px_-10px_var(--color-primary)]",
};
const toneBlob = {
  primary: "bg-primary/20",
  warning: "bg-signal-drowsy/20",
  danger: "bg-signal-danger/20",
  info: "bg-primary/15",
};
export function ErrorIllustration({ icon: Icon, tone, code }) {
  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
      <div
        className={`pointer-events-none absolute inset-0 -z-10 rounded-full blur-3xl ${toneBlob[tone]}`}
      />
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full border border-border/40"
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
      </motion.div>
      <motion.div
        aria-hidden
        className="absolute inset-3 rounded-full border border-border/30"
        animate={{ rotate: -360 }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: [0.95, 1, 0.95], opacity: 1, y: [0, -6, 0] }}
        transition={{
          scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
          opacity: { duration: 0.5 },
        }}
        className={`flex h-24 w-24 items-center justify-center rounded-2xl border backdrop-blur-xl ${toneRing[tone]}`}
      >
        <Icon className="h-10 w-10" strokeWidth={1.5} />
      </motion.div>
      <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-metric text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        {code}
      </div>
    </div>
  );
}
