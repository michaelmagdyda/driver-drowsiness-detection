import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { profile } from "./mockData";
function Field({ label, id, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
export function ProfileForm() {
  return (
    <Card className="glass-panel border-border/50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-base font-semibold">Personal information</div>
          <div className="text-xs text-muted-foreground">
            Update your public identity and contact details.
          </div>
        </div>
        <Button size="sm" className="gap-2">
          <Save className="h-3.5 w-3.5" /> Save changes
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Full name" id="fullName">
          <Input id="fullName" defaultValue={profile.fullName} />
        </Field>
        <Field label="Email address" id="email">
          <Input id="email" type="email" defaultValue={profile.email} />
        </Field>
        <Field label="Phone number" id="phone">
          <Input id="phone" defaultValue={profile.phone} />
        </Field>
        <Field label="Organization" id="org">
          <Input id="org" defaultValue={profile.organization} />
        </Field>
        <Field label="Department" id="dept">
          <Input id="dept" defaultValue={profile.department} />
        </Field>
        <Field label="Job title" id="title">
          <Input id="title" defaultValue={profile.jobTitle} />
        </Field>
        <Field label="Country" id="country">
          <Input id="country" defaultValue={profile.country} />
        </Field>
        <Field label="Time zone" id="tz">
          <Input id="tz" defaultValue={profile.timezone} />
        </Field>
        <Field label="Preferred language" id="lang">
          <Input id="lang" defaultValue={profile.language} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Biography" id="bio">
            <Textarea id="bio" rows={3} defaultValue={profile.bio} />
          </Field>
        </div>
      </div>
    </Card>
  );
}
