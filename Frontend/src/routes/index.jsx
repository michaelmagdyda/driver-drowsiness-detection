import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { TechStack } from "@/components/landing/TechStack";
import { Stats } from "@/components/landing/Stats";
import { Preview } from "@/components/landing/Preview";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
export const Route = createFileRoute("/")({
  component: LandingPage,
});
function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <TechStack />
        <Preview />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
