import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { StatisticsCard } from "@/components/profile/StatisticsCard";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { AccountCharts } from "@/components/profile/AccountCharts";
import { ActivityTimeline } from "@/components/profile/ActivityTimeline";
import { SecurityCard } from "@/components/profile/SecurityCard";
import { PreferenceSection } from "@/components/profile/PreferenceSection";
import { ConnectionCard } from "@/components/profile/ConnectionCard";
import { AchievementCard } from "@/components/profile/AchievementCard";
import { StorageCard } from "@/components/profile/StorageCard";
import { DangerZone } from "@/components/profile/DangerZone";
export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Account — DriveAlert" },
      {
        name: "description",
        content:
          "Manage your DriveAlert profile, security, preferences, connected services, and account activity.",
      },
      { property: "og:title", content: "Profile & Account — DriveAlert" },
      {
        property: "og:description",
        content:
          "Personal workspace for DriveAlert operators: identity, security, and preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});
function SectionTitle({ eyebrow, title, description }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
        {eyebrow}
      </div>
      <div className="mt-1 font-display text-lg font-semibold tracking-tight md:text-xl">
        {title}
      </div>
      {description && <div className="text-xs text-muted-foreground">{description}</div>}
    </div>
  );
}
function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <SectionTitle
          eyebrow="Account"
          title="Profile & Account"
          description="Your personal workspace across DriveAlert."
        />
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search profile settings…"
            className="h-9 border-border/60 bg-card/60 pl-8 text-sm backdrop-blur"
          />
        </div>
      </div>

      <ProfileHeader />

      <section className="space-y-3">
        <SectionTitle
          eyebrow="Overview"
          title="Account statistics"
          description="Snapshot of your activity across the platform."
        />
        <StatisticsCard />
      </section>

      <section className="space-y-3">
        <SectionTitle eyebrow="Identity" title="Personal information" />
        <ProfileForm />
      </section>

      <section className="space-y-3">
        <SectionTitle
          eyebrow="Insights"
          title="Usage & activity"
          description="How your account has been used recently."
        />
        <AccountCharts />
        <ActivityTimeline />
      </section>

      <section className="space-y-3">
        <SectionTitle
          eyebrow="Security"
          title="Security center"
          description="Sessions, devices, and posture recommendations."
        />
        <SecurityCard />
      </section>

      <section className="space-y-3">
        <SectionTitle
          eyebrow="Preferences"
          title="Account preferences"
          description="Personalize the workspace to fit your workflow."
        />
        <PreferenceSection />
      </section>

      <section className="space-y-3">
        <SectionTitle eyebrow="Integrations" title="Connected services" />
        <ConnectionCard />
      </section>

      <section className="space-y-3">
        <SectionTitle eyebrow="Milestones" title="Achievements" />
        <AchievementCard />
      </section>

      <section className="space-y-3">
        <SectionTitle eyebrow="Storage" title="Your storage" />
        <StorageCard />
      </section>

      <section className="space-y-3">
        <DangerZone />
      </section>
    </div>
  );
}
