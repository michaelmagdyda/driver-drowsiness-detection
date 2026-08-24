import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/about/HeroSection";
import { ProblemStatement } from "@/components/about/ProblemStatement";
import { SolutionFlow } from "@/components/about/SolutionFlow";
import { WorkflowTimeline } from "@/components/about/WorkflowTimeline";
import { AIPipeline } from "@/components/about/AIPipeline";
import { ArchitectureDiagram } from "@/components/about/ArchitectureDiagram";
import { TechnologyStack } from "@/components/about/TechnologyStack";
import { ModelComparison } from "@/components/about/ModelComparison";
import { ApplicationFeatures } from "@/components/about/ApplicationFeatures";
import { ResultsPerformance } from "@/components/about/ResultsPerformance";
import { ProjectTimeline } from "@/components/about/ProjectTimeline";
import { TeamSection } from "@/components/about/TeamSection";
import { FutureRoadmap } from "@/components/about/FutureRoadmap";
import { Acknowledgements } from "@/components/about/Acknowledgements";
import { AboutFooter } from "@/components/about/AboutFooter";
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About the Project — DriveAlert" },
      {
        name: "description",
        content:
          "How DriveAlert detects driver drowsiness in real time: architecture, AI pipeline, models, results, team, and roadmap.",
      },
      { property: "og:title", content: "About the Project — DriveAlert" },
      {
        property: "og:description",
        content:
          "An interactive presentation of the AI-Based Driver Drowsiness Detection System — problem, solution, architecture, and results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});
function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <HeroSection />
        <ProblemStatement />
        <SolutionFlow />
        <WorkflowTimeline />
        <AIPipeline />
        <ArchitectureDiagram />
        <TechnologyStack />
        <ModelComparison />
        <ApplicationFeatures />
        <ResultsPerformance />
        <ProjectTimeline />
        <TeamSection />
        <FutureRoadmap />
        <Acknowledgements />
      </main>
      <AboutFooter />
    </div>
  );
}
