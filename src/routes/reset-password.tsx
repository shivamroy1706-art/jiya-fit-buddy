import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — AI Fitness Trainer" },
      { name: "description", content: "Choose a new password for your AI Fitness Trainer account." },
      { property: "og:title", content: "Set a new password — AI Fitness Trainer" },
      { property: "og:description", content: "Choose a new password for your account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    void navigate({ to: "/home", replace: true });
  }

  return (
    <main className="app-shell flex flex-col items-center justify-center gap-6 px-6">
      <Logo size={120} />
      <form onSubmit={submit} className="w-full space-y-4">
        <h1 className="font-display text-xl font-bold">Set a new password</h1>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">New password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="h-12 w-full font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
        </Button>
      </form>
    </main>
  );
}
