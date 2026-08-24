import { motion } from "framer-motion";
import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
export function ActionButtons({ actions }) {
  const router = useRouter();
  const handle = (a) => {
    if (a.onClick === "reload") return () => window.location.reload();
    if (a.onClick === "back") return () => router.history.back();
    return () => {};
  };
  return (
    <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
      {actions.map((a, i) => {
        const variant =
          a.variant === "primary" ? "default" : a.variant === "ghost" ? "ghost" : "outline";
        const className =
          a.variant === "secondary" ? "border-border/70 bg-background/40" : undefined;
        const inner = (
          <motion.span
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex w-full items-center justify-center sm:w-auto"
          >
            <Button
              variant={variant}
              className={`w-full sm:w-auto ${className ?? ""}`}
              onClick={a.onClick ? handle(a) : undefined}
            >
              {a.label}
            </Button>
          </motion.span>
        );
        if (a.to) {
          return (
            <Link key={i} to={a.to} className="w-full sm:w-auto">
              {inner}
            </Link>
          );
        }
        if (a.href) {
          return (
            <a key={i} href={a.href} className="w-full sm:w-auto" target="_blank" rel="noreferrer">
              {inner}
            </a>
          );
        }
        return <span key={i}>{inner}</span>;
      })}
    </div>
  );
}
