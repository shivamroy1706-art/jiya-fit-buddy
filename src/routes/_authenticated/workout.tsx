import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Timer, Flame, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { useAuth } from "@/lib/auth";
import { fetchHomeData, todayISO, addXp } from "@/lib/app-data";
import { findSubstitute, type Prescription } from "@/lib/personalization";
import { fetchExercises, toAnswers } from "@/lib/plan";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/_authenticated/workout")({
  head: () => ({
    meta: [
      { title: "Today's Workout — AI Fitness Trainer" },
      {
        name: "description",
        content: "Your personalized session: exercises, sets, reps and rest — tick them off as you train.",
      },
      { property: "og:title", content: "Today's Workout" },
      { property: "og:description", content: "Guided sets, reps and rest for your personalized session." },
    ],
  }),
  component: WorkoutPage,
});

function WorkoutPage() {
  const { user } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["home", user?.id],
    queryFn: () => fetchHomeData(user!.id),
    enabled: !!user,
  });

  const [done, setDone] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);

  const day = data?.todayPlan ?? null;
  const logged = !!data?.todaysLog;
  const total = day?.prescriptions.length ?? 0;
  const completed = Object.values(done).filter(Boolean).length;

  async function swap(p: Prescription) {
    if (!user || !day || !data?.onboarding) return;
    setSwapping(p.exercise_id);
    try {
      const pool = await fetchExercises();
      const answers = toAnswers(data.onboarding as unknown as Record<string, unknown>);
      const target = pool.find((e) => e.id === p.exercise_id);
      if (!target) throw new Error("Exercise not found");
      const alt = findSubstitute(
        target,
        pool,
        answers,
        day.prescriptions.map((x) => x.exercise_id),
      );
      if (!alt) throw new Error("No safe alternative available");
      const next: Prescription[] = day.prescriptions.map((x) =>
        x.exercise_id === p.exercise_id
          ? { ...x, exercise_id: alt.id, slug: alt.slug, name: alt.name }
          : x,
      );
      const { error } = await supabase
        .from("workout_days")
        .update({ prescriptions: next, exercise_ids: next.map((x) => x.exercise_id) })
        .eq("id", day.id);
      if (error) throw error;
      toast.success(`Swapped to ${alt.name}`);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not swap exercise");
    } finally {
      setSwapping(null);
    }
  }


  async function finish() {
    if (!user || !day) return;
    setSaving(true);
    const ids = day.prescriptions.filter((p) => done[p.exercise_id]).map((p) => p.exercise_id);
    const ratio = total ? ids.length / total : 1;
    const { error } = await supabase.from("workout_logs").insert({
      user_id: user.id,
      date: todayISO(),
      workout_day_id: day.id,
      workout_name: day.name,
      duration: Math.round(day.estimated_duration * ratio),
      calories_burned: Math.round(day.estimated_calories * ratio),
      exercise_ids_completed: ids,
    });
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    await addXp(user.id, 50);
    setSaving(false);
    toast.success("Session logged · +50 XP");
    void refetch();
  }

  return (
    <main className="app-shell bg-background pb-28">
      <AppHeader title="Workout" />
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : !day ? (
        <p className="mx-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          No plan yet. Finish onboarding to generate your weekly plan.
        </p>
      ) : (
        <div className="space-y-4 px-4">
          <section className="rounded-3xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {day.is_rest ? "Rest day" : "Today"}
            </p>
            <h2 className="font-display text-xl font-bold">{day.name}</h2>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Timer className="size-3.5" /> {day.estimated_duration} min
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="size-3.5" /> ~{day.estimated_calories} kcal
              </span>
            </div>
          </section>

          {day.is_rest ? (
            <section className="rounded-3xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              Recovery day: light walking, mobility work, 2–3 L water and 7–8 h sleep.
            </section>
          ) : (
            <>
              <ul className="space-y-2">
                {day.prescriptions.map((p) => {
                  const isDone = !!done[p.exercise_id];
                  return (
                    <li key={p.exercise_id}>
                      <button
                        type="button"
                        onClick={() => setDone((d) => ({ ...d, [p.exercise_id]: !isDone }))}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left"
                      >
                        {isDone ? (
                          <CheckCircle2 className="size-5 shrink-0 text-primary" />
                        ) : (
                          <Circle className="size-5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {p.sets} × {p.reps} · {p.rest_seconds}s rest
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={() => void finish()}
                disabled={saving || logged || completed === 0}
                className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {logged
                  ? "Already logged today"
                  : saving
                    ? "Saving…"
                    : `Finish workout (${completed}/${total})`}
              </button>
            </>
          )}
        </div>
      )}
      <BottomNav />
    </main>
  );
}
