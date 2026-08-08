import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Fitness Trainer — Personalized AI Workouts & Nutrition" },
      {
        name: "description",
        content:
          "Meet Jiya, your AI fitness coach. Personalized workout plans, barcode food scanning, progress charts and friend leaderboards.",
      },
      { property: "og:title", content: "AI Fitness Trainer — Personalized AI Workouts" },
      {
        property: "og:description",
        content: "Personalized AI workout plans, food scanning and progress tracking with your coach Jiya.",
      },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!minElapsed || loading) return;

    if (!user) {
      void navigate({ to: "/auth", replace: true });
      return;
    }

    void (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("onboarding_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.onboarding_completed_at) {
        void navigate({ to: "/home", replace: true });
      } else {
        void navigate({ to: "/onboarding", replace: true });
      }
    })();
  }, [minElapsed, loading, user, navigate]);

  return (
    <main className="app-shell flex flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20 blur-2xl" />
        <div className="animate-logo-in">
          <Logo size={200} />
        </div>
      </div>
      <p className="animate-fade-up max-w-xs text-center text-sm text-muted-foreground">
        Let&apos;s build a stronger, healthier you. One step at a time.
      </p>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
    </main>
  );
}
