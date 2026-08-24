import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Loader2, Mail, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { getUserRole, roleHomePath } from "@/lib/auth-role";
const searchSchema = z.object({
  redirect: z.string().optional(),
});
export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});
const REMEMBER_KEY = "drivealert:remember_email";
function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  useEffect(() => {
    // If already signed in, route by role.
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const role = await getUserRole(data.user.id);
      navigate({ to: redirect ?? roleHomePath(role), replace: true });
    });
  }, [navigate, redirect]);
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your DriveAlert cockpit."
      footer={
        <>
          Access is invite-only.{" "}
          <a
            href="mailto:team@drivealert.app"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Request an account
          </a>
          .
        </>
      }
    >
      <SignInForm redirect={redirect} />
      <Divider />
      <GoogleButton />
    </AuthLayout>
  );
}
function SignInForm({ redirect }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(REMEMBER_KEY) : null;
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);
  async function handle(e) {
    e.preventDefault();
    setError(null);
    const parsed = z
      .object({
        email: z.string().trim().email("Please enter a valid email."),
        password: z.string().min(6, "Password must be at least 6 characters."),
      })
      .safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (signInError || !data.user) {
      setLoading(false);
      setError(mapAuthError(signInError?.message));
      return;
    }
    if (remember) localStorage.setItem(REMEMBER_KEY, parsed.data.email);
    else localStorage.removeItem(REMEMBER_KEY);
    const role = await getUserRole(data.user.id);
    toast.success(`Signed in · ${role === "admin" ? "Administrator" : "Guest"}`);
    navigate({ to: redirect ?? roleHomePath(role), replace: true });
  }
  return (
    <form onSubmit={handle} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="signin-email"
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
          <Link
            to="/forgot-password"
            className="text-xs text-primary transition-colors hover:text-primary/80"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="signin-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Checkbox
          checked={remember}
          onCheckedChange={(v) => setRemember(v === true)}
          aria-label="Remember me"
        />
        Remember me on this device
      </label>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </motion.div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            <LogIn className="mr-2 h-4 w-4" /> Sign in
          </>
        )}
      </Button>
    </form>
  );
}
function Divider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        or
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
function GoogleButton() {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    window.location.href = "/dashboard";
  }
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full border-border/70 bg-background/40 backdrop-blur"
      onClick={handle}
      disabled={loading}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
      Continue with Google
    </Button>
  );
}
function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.94 0 3.24.83 3.98 1.54l2.72-2.62A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.77 0 9.59-4.05 9.59-9.76 0-.66-.07-1.16-.16-1.66H12Z"
      />
    </svg>
  );
}
function mapAuthError(msg) {
  if (!msg) return "Sign in failed. Please try again.";
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login")) return "Incorrect email or password.";
  if (lower.includes("email not confirmed")) return "Please confirm your email first.";
  if (lower.includes("rate limit")) return "Too many attempts. Please wait a moment.";
  return msg;
}
