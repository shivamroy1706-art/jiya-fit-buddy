import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Dumbbell, Droplets, Moon, Apple, ChevronRight, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { ProgressRing } from "@/components/app/ProgressRing";
import { StepsCard } from "@/components/app/StepsCard";
import { useAuth } from "@/lib/auth";
import { fetchHomeData, todayISO } from "@/lib/app-data";
import { levelFromXp } from "@/lib/personalization";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Today's Plan — AI Fitness Trainer" },
      {
        name: "description",
        content: "Your streak, today's workout, calories, water and sleep — all in one dashboard.",
      },
      { property: "og:title", content: "Your Fitness Dashboard" },
      { property: "og:description", content: "Track today's workout, nutrition, water and streak." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["home", user?.id],
    queryFn: () => fetchHomeData(user!.id),
    enabled: !!user,
  });

  const xp = data?.profile?.xp ?? 0;
  const level = levelFromXp(xp);
  const firstName = (data?.profile?.name ?? "there").split(" ")[0];
  const targets = data?.onboarding;
  const todayPlan = data?.todayPlan;
  const done = !!data?.todaysLog;
  const waterGoal = 3000;

  async function logWater() {
    if (!user) return;
    await supabase.from("water_logs").insert({ user_id: user.id, date: todayISO(), ml: 250 });
    void refetch();
  }

  async function logSleep(hours: number) {
    if (!user) return;
    await supabase
      .from("sleep_logs")
      .upsert({ user_id: user.id, date: todayISO(), hours }, { onConflict: "user_id,date" });
    void refetch();
  }


  return (
    <main className="app-shell bg-background pb-28">
      <AppHeader showBell />
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 px-4">
          <section>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="font-display text-2xl font-bold">{firstName} 👋</h1>
          </section>

          <section className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-4">
            <ProgressRing
              value={done ? 100 : todayPlan?.is_rest ? 100 : 0}
              label={done || todayPlan?.is_rest ? "✓" : "0%"}
              sublabel="today"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {todayPlan?.is_rest ? "Rest day" : "Today's workout"}
              </p>
              <p className="truncate font-display text-lg font-bold">{todayPlan?.name ?? "No plan yet"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {todayPlan
                  ? `${todayPlan.prescriptions.length} exercises · ${todayPlan.estimated_duration} min · ~${todayPlan.estimated_calories} kcal`
                  : "Finish onboarding to generate your plan"}
              </p>
              <Link
                to="/workout"
                data-tour="today-plan"
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                {done ? "View session" : todayPlan?.is_rest ? "Recovery ideas" : "Start workout"}
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Stat icon={<Flame className="size-4" />} label="Streak" value={`${data?.profile?.streak_days ?? 0} days`} />
            <Stat icon={<Dumbbell className="size-4" />} label={level.title} value={`Lvl ${level.level} · ${xp} XP`} />
            <Stat
              icon={<Apple className="size-4" />}
              label="Calorie target"
              value={targets?.daily_calories ? `${targets.daily_calories} kcal` : "—"}
            />
            <Stat
              icon={<Moon className="size-4" />}
              label="Sleep"
              value={data?.sleepHours ? `${data.sleepHours} h` : "Not logged"}
            />
          </section>

          {user && (
            <StepsCard
              userId={user.id}
              initialSteps={data?.steps ?? 0}
              weightKg={targets?.weight_kg ?? null}
            />
          )}

          <section className="rounded-3xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Droplets className="size-4 text-primary" /> Water
              </div>
              <span className="text-xs text-muted-foreground">
                {(data?.waterMl ?? 0) / 1000} / {waterGoal / 1000} L
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, ((data?.waterMl ?? 0) / waterGoal) * 100)}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => void logWater()}
              className="mt-3 rounded-full border border-primary/40 px-4 py-1.5 text-xs font-semibold text-primary"
            >
              + 250 ml
            </button>
          </section>

          <section className="rounded-3xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Moon className="size-4 text-primary" /> Sleep last night
              </div>
              <span className="text-xs text-muted-foreground">
                {data?.sleepHours ? `${data.sleepHours} h` : "Not logged"}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              {[5, 6, 7, 8, 9].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => void logSleep(h)}
                  className="flex-1 rounded-full border border-border py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  {h}h
                </button>
              ))}
            </div>
          </section>


          {targets?.daily_calories && (
            <section className="rounded-3xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold">Daily macro targets</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Protein", value: targets.protein_g, unit: "g" },
                  { label: "Carbs", value: targets.carbs_g, unit: "g" },
                  { label: "Fat", value: targets.fat_g, unit: "g" },
                ].map((m) => (
                  <div key={m.label} className="rounded-2xl bg-surface-alt p-3">
                    <p className="font-display text-lg font-bold text-primary">
                      {m.value ?? "—"}
                      <span className="text-xs">{m.unit}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent scans</h2>
              <Link to="/scan" className="text-xs font-semibold text-primary">
                Scan food
              </Link>
            </div>
            {(data?.scans ?? []).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                Nothing scanned yet. Scan a barcode to see a full nutrition breakdown.
              </p>
            ) : (
              <ul className="space-y-2">
                {data!.scans.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 font-display font-bold text-primary">
                      {s.grade ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.food_name}</span>
                      <span className="text-xs text-muted-foreground">{s.calories ?? "—"} kcal</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      <BottomNav />
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-1 font-display text-base font-bold">{value}</p>
    </div>
  );
}
