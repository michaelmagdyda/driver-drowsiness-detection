import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Loader2, Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});
function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  async function handle(e) {
    e.preventDefault();
    setError(null);
    const parsed = z.string().trim().email("Please enter a valid email.").safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }
  return (
    <AuthLayout
      title={sent ? "Check your inbox" : "Reset your password"}
      subtitle={
        sent
          ? "If an account exists for that email, a reset link is on its way."
          : "Enter the email associated with your DriveAlert account."
      }
      backTo={{ to: "/auth", label: "Back to sign in" }}
    >
      {sent ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div className="text-sm">
              <div className="font-medium text-foreground">Reset link sent</div>
              <div className="text-xs text-muted-foreground">to {email}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Didn't receive it? Check spam, or try again in a minute.
          </p>
          <Button asChild className="w-full">
            <Link to="/auth">
              Back to sign in <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      ) : (
        <form onSubmit={handle} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                placeholder="you@company.com"
                required
              />
            </div>
          </div>

          {error && (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending link…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
