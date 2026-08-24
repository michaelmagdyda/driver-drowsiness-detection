import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Camera, Pencil, ShieldCheck, Circle } from "lucide-react";
import { profile } from "./mockData";
export function ProfileHeader() {
  return (
    <Card className="glass-panel relative overflow-hidden border-border/50 p-6 md:p-8">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(1200px 300px at 10% -20%, color-mix(in oklch, var(--color-primary) 18%, transparent), transparent 60%), radial-gradient(900px 250px at 90% -20%, color-mix(in oklch, var(--color-chart-2) 14%, transparent), transparent 60%)",
        }}
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
          <div className="relative">
            <Avatar className="h-24 w-24 border-2 border-primary/40 shadow-[0_0_40px_-10px_var(--color-primary)]">
              <AvatarFallback className="bg-primary/10 font-display text-2xl text-primary">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            <button
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/90 text-primary shadow-md backdrop-blur transition hover:bg-primary/10"
              aria-label="Change avatar"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                {profile.fullName}
              </h1>
              <Badge className="gap-1 border-primary/30 bg-primary/10 text-primary hover:bg-primary/10">
                <ShieldCheck className="h-3 w-3" /> {profile.role}
              </Badge>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
                <Circle className="h-2 w-2 fill-emerald-300 text-emerald-300" /> Active
              </span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {profile.jobTitle} · {profile.organization}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>{profile.email}</span>
              <span>Joined {profile.joinedAt}</span>
              <span>Last login {profile.lastLogin}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Camera className="h-4 w-4" /> Change avatar
          </Button>
          <Button className="gap-2">
            <Pencil className="h-4 w-4" /> Edit profile
          </Button>
        </div>
      </div>
    </Card>
  );
}
