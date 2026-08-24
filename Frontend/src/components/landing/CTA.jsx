import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
export function CTA() {
  return (
    <section id="about" className="relative border-t border-border/60 py-28">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-card/80 via-card/60 to-primary/10 p-10 text-center backdrop-blur-xl md:p-16"
        >
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-chart-2/30 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Try the demo
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-5xl">
              Experience DriveAlert live.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              Launch the cockpit and watch AI read fatigue in real time. No install. No setup. Just
              your camera and our model.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-6">
                <Link to="/auth">
                  <PlayCircle className="mr-2 h-4 w-4" /> Start demo
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-6">
                <a href="#contact">
                  Contact team <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
