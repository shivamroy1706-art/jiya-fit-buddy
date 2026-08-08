import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Check, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { JiyaAvatar } from "@/components/brand/JiyaAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AI Fitness Trainer" },
      {
        name: "description",
        content:
          "Create your AI Fitness Trainer account and meet Jiya, your personal AI fitness coach.",
      },
      { property: "og:title", content: "Sign in — AI Fitness Trainer" },
      { property: "og:description", content: "Create your account and start training with Jiya." },
    ],
  }),
  component: AuthScreen,
});

type Mode = "welcome" | "signup" | "login" | "forgot" | "username";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function AuthScreen() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("welcome");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const usernameFormatError = useMemo(() => {
    if (!username) return null;
    if (!USERNAME_RE.test(username)) return "3–20 characters, letters, numbers and underscores only.";
    return null;
  }, [username]);

  // Real-time debounced uniqueness check against the database.
  useEffect(() => {
    if (!username || usernameFormatError) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_username_available", { _username: username });
      setChecking(false);
      setAvailable(error ? null : Boolean(data));
    }, 400);
    return () => clearTimeout(t);
  }, [username, usernameFormatError]);

  const routeAfterAuth = useCallback(
    async (userId: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (!profile) {
        setMode("username");
        return;
      }
      const { data: onboarding } = await supabase
        .from("user_profiles")
        .select("onboarding_completed_at")
        .eq("user_id", userId)
        .maybeSingle();
      void navigate({
        to: onboarding?.onboarding_completed_at ? "/home" : "/onboarding",
        replace: true,
      });
    },
    [navigate],
  );

  // Session already present (e.g. returning from Google) → route on.
  useEffect(() => {
    if (authLoading || !user) return;
    if (mode === "username") return;
    void routeAfterAuth(user.id);
  }, [authLoading, user, mode, routeAfterAuth]);

  async function suggestUsername(base: string) {
    const clean = base.replace(/[^A-Za-z0-9_]/g, "").slice(0, 14) || "athlete";
    for (let i = 0; i < 12; i += 1) {
      const candidate = i === 0 ? clean : `${clean}${Math.floor(Math.random() * 9000) + 100}`;
      const { data } = await supabase.rpc("is_username_available", { _username: candidate });
      if (data) return candidate;
    }
    return `${clean}${Date.now().toString().slice(-5)}`;
  }

  async function createProfileRows(userId: string, userEmail: string | null, fullName: string, handle: string) {
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      name: fullName || handle,
      username: handle,
      email: userEmail,
    });
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        throw new Error("That username was just taken. Please pick another.");
      }
      throw new Error(error.message);
    }
    await supabase.from("user_profiles").upsert({ user_id: userId }, { onConflict: "user_id" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (usernameFormatError) { toast.error(usernameFormatError); return; }
    if (available === false) { toast.error("Username already taken"); return; }
    if (available !== true) { toast.error("Please wait for the username check"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name, username } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Signup failed");
      await createProfileRows(data.user.id, email.trim(), name.trim(), username);
      toast.success(`Welcome, ${name.split(" ")[0] || username}!`);
      void navigate({ to: "/onboarding", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create your account");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await routeAfterAuth(data.user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign you in");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent. Check your inbox.");
      setMode("login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) throw new Error(String(result.error));
      if (result.redirected) return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleClaimUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (usernameFormatError) { toast.error(usernameFormatError); return; }
    if (available !== true) { toast.error("Pick an available username"); return; }
    setBusy(true);
    try {
      const displayName =
        (user.user_metadata["full_name"] as string) || (user.user_metadata["name"] as string) || username;
      await createProfileRows(user.id, user.email ?? null, displayName, username);
      void navigate({ to: "/onboarding", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save username");
    } finally {
      setBusy(false);
    }
  }

  // Prefill a suggested username when a Google user needs one.
  useEffect(() => {
    if (mode !== "username" || username || !user) return;
    const base =
      ((user.user_metadata["full_name"] as string) ?? user.email?.split("@")[0] ?? "athlete") as string;
    void suggestUsername(base).then(setUsername);
  }, [mode, username, user]);

  const step = mode === "welcome" ? 1 : mode === "username" ? 3 : 2;

  return (
    <main className="app-shell flex flex-col px-6 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      {mode !== "welcome" && (
        <div className="mb-6 flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-primary" : "bg-border")}
            />
          ))}
        </div>
      )}

      {mode === "welcome" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <Logo size={168} />
          <div>
            <h1 className="font-display text-2xl font-bold">Welcome to AI Fitness Trainer</h1>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left">
              <JiyaAvatar size={48} />
              <p className="text-sm">
                <span className="font-semibold text-primary">Hi, I&apos;m Jiya</span>, your AI Fitness
                Coach.
                <br />
                <span className="text-muted-foreground">
                  Let&apos;s build a stronger, healthier you. One step at a time.
                </span>
              </p>
            </div>
          </div>
          <div className="w-full space-y-3">
            <Button className="h-12 w-full text-base font-semibold" onClick={() => setMode("signup")}>
              Get Started <ArrowRight className="size-4" />
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground"
              onClick={() => setMode("login")}
            >
              Already have an account? <span className="font-semibold text-primary">Log in</span>
            </button>
          </div>
        </div>
      )}

      {mode === "signup" && (
        <form onSubmit={handleSignup} className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Create your account</h1>
            <p className="text-sm text-muted-foreground">Jiya needs a few details to get started.</p>
          </div>

          <Field label="Full Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Thompson" required />
          </Field>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Username</Label>
            <div className="relative">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                placeholder="alex_lifts"
                autoCapitalize="none"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                {!checking && available === true && <Check className="size-4 text-primary" />}
                {!checking && available === false && <X className="size-4 text-destructive" />}
              </span>
            </div>
            {usernameFormatError && <p className="mt-1 text-xs text-destructive">{usernameFormatError}</p>}
            {!usernameFormatError && available === false && (
              <p className="mt-1 text-xs text-destructive">Username already taken</p>
            )}
            {!usernameFormatError && available === true && (
              <p className="mt-1 text-xs text-primary">Nice — that one&apos;s free!</p>
            )}
          </div>

          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
          </Field>

          <PasswordField
            value={password}
            onChange={setPassword}
            show={showPassword}
            toggle={() => setShowPassword((v) => !v)}
          />

          <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Create Account"}
          </Button>

          <Divider />
          <GoogleButton onClick={handleGoogle} disabled={busy} />

          <button type="button" className="mt-auto text-sm text-muted-foreground" onClick={() => setMode("login")}>
            Already have an account? <span className="font-semibold text-primary">Log in</span>
          </button>
        </form>
      )}

      {mode === "login" && (
        <form onSubmit={handleLogin} className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Jiya has been waiting for you.</p>
          </div>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <PasswordField value={password} onChange={setPassword} show={showPassword} toggle={() => setShowPassword((v) => !v)} />
          <button type="button" className="self-end text-xs text-primary" onClick={() => setMode("forgot")}>
            Forgot password?
          </button>
          <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Log In"}
          </Button>
          <Divider />
          <GoogleButton onClick={handleGoogle} disabled={busy} />
          <button type="button" className="mt-auto text-sm text-muted-foreground" onClick={() => setMode("signup")}>
            New here? <span className="font-semibold text-primary">Create an account</span>
          </button>
        </form>
      )}

      {mode === "forgot" && (
        <form onSubmit={handleForgot} className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Reset your password</h1>
            <p className="text-sm text-muted-foreground">We&apos;ll email you a secure reset link.</p>
          </div>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Button type="submit" className="h-12 w-full font-semibold" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
          </Button>
          <button type="button" className="mt-auto text-sm text-muted-foreground" onClick={() => setMode("login")}>
            Back to <span className="font-semibold text-primary">log in</span>
          </button>
        </form>
      )}

      {mode === "username" && (
        <form onSubmit={handleClaimUsername} className="flex flex-1 flex-col gap-4">
          <div className="flex items-center gap-3">
            <JiyaAvatar size={44} />
            <p className="text-sm">
              Almost there! <span className="text-muted-foreground">Pick a username your friends can find you by.</span>
            </p>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Username</Label>
            <div className="relative">
              <Input value={username} onChange={(e) => setUsername(e.target.value.trim())} autoCapitalize="none" required />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                {!checking && available === true && <Check className="size-4 text-primary" />}
                {!checking && available === false && <X className="size-4 text-destructive" />}
              </span>
            </div>
            {usernameFormatError && <p className="mt-1 text-xs text-destructive">{usernameFormatError}</p>}
            {!usernameFormatError && available === false && (
              <p className="mt-1 text-xs text-destructive">Username already taken</p>
            )}
          </div>
          <Button type="submit" className="h-12 w-full font-semibold" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
          </Button>
        </form>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  show,
  toggle,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggle: () => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">Password</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="At least 8 characters"
          required
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-semibold text-[#1f1f1f] disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z" />
      </svg>
      Continue with Google
    </button>
  );
}
