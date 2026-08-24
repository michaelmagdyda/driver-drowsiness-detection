import { createFileRoute } from "@tanstack/react-router";
import { ExplainabilityHeader } from "@/components/explainability/ExplainabilityHeader";
import { DecisionSummary } from "@/components/explainability/DecisionSummary";
import { LiveExplainability } from "@/components/explainability/LiveExplainability";
import { TemporalAnalysis } from "@/components/explainability/TemporalAnalysis";
import { EARChart } from "@/components/explainability/EARChart";
import { MARChart } from "@/components/explainability/MARChart";
import { HeadPoseCard } from "@/components/explainability/HeadPoseCard";
import { FatigueEngine } from "@/components/explainability/FatigueEngine";
import { FeatureImportanceChart } from "@/components/explainability/FeatureImportanceChart";
import { ConfidenceAnalysis } from "@/components/explainability/ConfidenceAnalysis";
import { ModelPerformance } from "@/components/explainability/ModelPerformance";
import { FrameTimeline } from "@/components/explainability/FrameTimeline";
import { DecisionTree } from "@/components/explainability/DecisionTree";
import { PipelineDiagram } from "@/components/explainability/PipelineDiagram";
import { ModelComparisonCard } from "@/components/explainability/ModelComparisonCard";
import { RecommendationCard } from "@/components/explainability/RecommendationCard";
import { ExportPanel } from "@/components/explainability/ExportPanel";
import { FiltersBar } from "@/components/explainability/FiltersBar";
export const Route = createFileRoute("/_authenticated/explainability")({
  head: () => ({
    meta: [
      { title: "AI Explainability — DriveAlert" },
      {
        name: "description",
        content:
          "Inspect how and why the DriveAlert AI reaches each drowsiness decision — features, thresholds, temporal analysis, and model performance.",
      },
      { property: "og:title", content: "AI Explainability — DriveAlert" },
      {
        property: "og:description",
        content:
          "Transparent, explainable AI dashboard for the DriveAlert driver drowsiness detection platform.",
      },
    ],
  }),
  component: ExplainabilityPage,
});
function ExplainabilityPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <ExplainabilityHeader />
      <FiltersBar />
      <DecisionSummary />
      <LiveExplainability />
      <TemporalAnalysis />
      <div className="grid gap-6 xl:grid-cols-2">
        <EARChart />
        <MARChart />
      </div>
      <HeadPoseCard />
      <FatigueEngine />
      <FeatureImportanceChart />
      <ConfidenceAnalysis />
      <ModelPerformance />
      <FrameTimeline />
      <DecisionTree />
      <PipelineDiagram />
      <ModelComparisonCard />
      <RecommendationCard />
      <ExportPanel />
    </div>
  );
}
