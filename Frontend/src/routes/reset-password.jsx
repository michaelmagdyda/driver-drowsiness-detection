import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { scorePassword } from "@/lib/password-strength";
export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});
function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    // Supabase places `type=recovery` in the URL hash on the reset link.
    // The client auto-processes it and emits PASSWORD_RECOVERY.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const isRecoveryHash = hash.includes("type=recovery");
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Fallback: if we have a session already (link opened), allow the form.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else if (!isRecoveryHash) {
        // Give the client a beat to consume the hash.
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (!d2.session) setInvalid(true);
          });
        }, 800);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  async function handle(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (scorePassword(password).score < 2) {
      setError("Please choose a stronger password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1600);
  }
  if (invalid) {
    return (
      <AuthLayout
        title="Reset link expired"
        subtitle="This password reset link is invalid or has already been used."
        backTo={{ to: "/auth", label: "Back to sign in" }}
      >
        <Button asChild className="w-full">
          <Link to="/forgot-password">
            Request a new link <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </AuthLayout>
    );
  }
  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="Signing you in…">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-3 py-4"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Your password has been changed successfully.
          </p>
        </motion.div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
    >
      {!ready ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying reset link…
        </div>
      ) : (
        <form onSubmit={handle} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
            <PasswordStrengthMeter value={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
              required
            />
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" /> Update password
              </>
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
