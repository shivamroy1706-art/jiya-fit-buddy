import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { regeneratePlan } from "@/lib/plan";
import { WEEKDAYS } from "@/lib/personalization";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Build Your Plan — AI Fitness Trainer" },
      {
        name: "description",
        content:
          "Answer a few questions about your goal, equipment and schedule so Jiya can build your personalized training plan.",
      },
      { property: "og:title", content: "Build Your Personalized Plan" },
      {
        property: "og:description",
        content: "Goal, equipment, level and schedule — your plan is generated from your answers.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { edit?: boolean } =>
    search["edit"] === true || search["edit"] === "true" || search["edit"] === "1" ? { edit: true } : {},
  component: Onboarding,
});

type Answers = {
  age: number | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  goal: string | null;
  target_weight: number | null;
  workout_location: string | null;
  equipment_home: string[];
  equipment_gym: string[];
  desired_results: string[];
  planning_style: string | null;
  focus_muscles: string[];
  fitness_level: string | null;
  intensity: string | null;
  past_experience: string | null;
  days_per_week: number | null;
  session_duration: number | null;
  injuries: string[];
};

const EMPTY: Answers = {
  age: null,
  gender: null,
  height: null,
  weight: null,
  goal: null,
  target_weight: null,
  workout_location: null,
  equipment_home: [],
  equipment_gym: [],
  desired_results: [],
  planning_style: null,
  focus_muscles: [],
  fitness_level: null,
  intensity: null,
  past_experience: null,
  days_per_week: null,
  session_duration: null,
  injuries: [],
};

type Step =
  | { key: keyof Answers; kind: "number"; title: string; hint?: string; unit: string; min: number; max: number }
  | { key: keyof Answers; kind: "single"; title: string; hint?: string; options: string[] }
  | { key: keyof Answers; kind: "multi"; title: string; hint?: string; options: string[] }
  | { key: keyof Answers; kind: "singleNum"; title: string; hint?: string; options: number[]; suffix: string };

const STEPS: Step[] = [
  { key: "age", kind: "number", title: "How old are you?", hint: "Used for your calorie and intensity targets.", unit: "years", min: 13, max: 90 },
  { key: "gender", kind: "single", title: "What's your gender?", options: ["Male", "Female", "Other"] },
  { key: "height", kind: "number", title: "How tall are you?", unit: "cm", min: 120, max: 230 },
  { key: "weight", kind: "number", title: "What's your current weight?", unit: "kg", min: 30, max: 250 },
  {
    key: "goal",
    kind: "single",
    title: "What's your main goal?",
    hint: "This drives your split, reps and calories.",
    options: ["Lose Weight", "Build Muscle", "Gain Strength", "Improve Endurance", "Stay Fit", "Athletic Performance"],
  },
  { key: "target_weight", kind: "number", title: "What weight are you aiming for?", hint: "We use this to estimate your timeline.", unit: "kg", min: 30, max: 250 },
  { key: "workout_location", kind: "single", title: "Where will you train?", options: ["Home", "Gym", "Both"] },
  {
    key: "equipment_home",
    kind: "multi",
    title: "What do you have at home?",
    hint: "Pick everything you can use.",
    options: ["No Equipment", "Dumbbells", "Resistance Bands", "Kettlebell", "Pull-up Bar", "Bench", "Yoga Mat", "Jump Rope", "Treadmill", "Exercise Bike"],
  },
  {
    key: "equipment_gym",
    kind: "multi",
    title: "What's available at your gym?",
    hint: "Skip if you only train at home.",
    options: ["Full Gym", "Basic Gym", "Free Weights", "Dumbbells", "Bench", "Cable Machine", "Power Rack", "Smith Machine", "Cardio Machines"],
  },
  {
    key: "desired_results",
    kind: "multi",
    title: "What results do you want to see?",
    options: ["Bigger Chest", "Bigger Arms", "Wider Shoulders", "Bigger Back", "Bigger Legs", "Bigger Glutes", "Six-Pack Abs", "Better Posture", "Better Stamina"],
  },
  {
    key: "planning_style",
    kind: "single",
    title: "How do you like to plan?",
    options: ["Follow a fixed plan", "Flexible week to week", "Let Jiya decide daily"],
  },
  {
    key: "focus_muscles",
    kind: "multi",
    title: "Which muscles should get extra work?",
    options: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Abs", "Quads", "Hamstrings", "Glutes", "Calves", "Full Body"],
  },
  { key: "fitness_level", kind: "single", title: "How would you rate your fitness level?", options: ["Beginner", "Intermediate", "Advanced"] },
  { key: "intensity", kind: "single", title: "How hard do you want to train?", options: ["Easy", "Moderate", "Hard", "Intense"] },
  {
    key: "past_experience",
    kind: "single",
    title: "Have you trained before?",
    options: ["Never trained", "Less than 6 months", "1-2 years", "3+ years"],
  },
  { key: "days_per_week", kind: "singleNum", title: "How many days a week can you train?", options: [1, 2, 3, 4, 5, 6, 7], suffix: "days" },
  { key: "session_duration", kind: "singleNum", title: "How long is each session?", options: [15, 30, 45, 60, 75, 90], suffix: "min" },
  {
    key: "injuries",
    kind: "multi",
    title: "Any injuries or conditions we should respect?",
    hint: "Unsafe exercises get replaced automatically.",
    options: ["None", "Knee Pain", "Lower Back Pain", "Shoulder Injury", "Wrist Pain", "Neck Pain", "Hernia", "Heart Condition", "Pregnancy", "High Blood Pressure"],
  },
];

function Onboarding() {
  const navigate = useNavigate();
  const { edit } = Route.useSearch();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        if (data.onboarding_completed_at && !edit) {
          void navigate({ to: "/home", replace: true });
          return;
        }
        setAnswers((prev) => ({
          ...prev,
          age: data.age,
          gender: data.gender,
          height: data.height,
          weight: data.weight,
          goal: data.goal,
          target_weight: data.target_weight,
          workout_location: data.workout_location,
          equipment_home: data.equipment_home ?? [],
          equipment_gym: data.equipment_gym ?? [],
          desired_results: data.desired_results ?? [],
          planning_style: data.planning_style,
          focus_muscles: data.focus_muscles ?? [],
          fitness_level: data.fitness_level,
          intensity: data.intensity,
          past_experience: data.past_experience,
          days_per_week: data.days_per_week,
          session_duration: data.session_duration,
          injuries: data.injuries ?? [],
        }));
        setStep(edit ? 0 : Math.min(data.onboarding_step ?? 0, STEPS.length - 1));
      }
      setReady(true);
    })();
  }, [user, navigate, edit]);

  const current = STEPS[step]!;
  const value = answers[current.key];

  const canAdvance = useMemo(() => {
    if (current.kind === "multi") {
      if (current.key === "equipment_gym") return true; // optional for home-only users
      return Array.isArray(value) && value.length > 0;
    }
    return value !== null && value !== undefined && value !== "";
  }, [current, value]);

  function set<K extends keyof Answers>(key: K, v: Answers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: v }));
  }

  function toggle(key: keyof Answers, option: string) {
    const list = (answers[key] as string[]) ?? [];
    let next: string[];
    if (option === "None" || option === "No Equipment") {
      next = list.includes(option) ? [] : [option];
    } else {
      next = list.includes(option)
        ? list.filter((o) => o !== option)
        : [...list.filter((o) => o !== "None" && o !== "No Equipment"), option];
    }
    set(key, next as Answers[typeof key]);
  }

  async function persist(nextStep: number) {
    if (!user) return;
    await supabase.from("user_profiles").upsert(
      {
        user_id: user.id,
        age: answers.age,
        gender: answers.gender,
        height: answers.height,
        weight: answers.weight,
        goal: answers.goal,
        target_weight: answers.target_weight,
        workout_location: answers.workout_location,
        equipment_home: answers.equipment_home,
        equipment_gym: answers.equipment_gym,
        desired_results: answers.desired_results,
        planning_style: answers.planning_style,
        focus_muscles: answers.focus_muscles,
        fitness_level: answers.fitness_level,
        intensity: answers.intensity,
        past_experience: answers.past_experience,
        days_per_week: answers.days_per_week,
        session_duration: answers.session_duration,
        injuries: answers.injuries,
        onboarding_step: nextStep,
      },
      { onConflict: "user_id" },
    );
  }

  async function next() {
    if (!canAdvance || !user) return;
    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      void persist(nextStep);
      return;
    }

    setSaving(true);
    try {
      const days = answers.days_per_week ?? 3;
      const schedule = [...WEEKDAYS].filter((_, i) => [0, 2, 4, 1, 3, 5, 6].slice(0, days).includes(i));
      await persist(STEPS.length - 1);
      const { error } = await supabase
        .from("user_profiles")
        .update({
          schedule_days: schedule,
          schedule_time_block: "Evening",
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
      await regeneratePlan(user.id);
      toast.success("Your plan is ready!");
      void navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build your plan");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <main className="app-shell flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <main className="app-shell flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <button
          type="button"
          aria-label="Previous question"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="flex size-9 items-center justify-center rounded-full border border-border bg-surface disabled:opacity-40"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          {step + 1}/{STEPS.length}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-32">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={40} />
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">Building your plan</span>
        </div>
        <h1 className="font-display text-2xl font-bold leading-tight">{current.title}</h1>
        {current.hint && <p className="mt-2 text-sm text-muted-foreground">{current.hint}</p>}

        <div className="mt-7 space-y-2.5">
          {current.kind === "number" && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                min={current.min}
                max={current.max}
                value={(value as number | null) ?? ""}
                onChange={(e) => set(current.key, (e.target.value === "" ? null : Number(e.target.value)) as never)}
                className="w-full bg-transparent font-display text-3xl font-bold outline-none"
                placeholder="0"
              />
              <span className="text-sm font-medium text-muted-foreground">{current.unit}</span>
            </div>
          )}

          {current.kind === "single" &&
            current.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => set(current.key, option as never)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border p-4 text-left text-sm font-medium transition-colors",
                  value === option
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface text-muted-foreground",
                )}
              >
                {option}
                <span
                  className={cn(
                    "size-4 rounded-full border",
                    value === option ? "border-primary bg-primary" : "border-border",
                  )}
                />
              </button>
            ))}

          {current.kind === "multi" && (
            <div className="flex flex-wrap gap-2">
              {current.options.map((option) => {
                const active = ((value as string[]) ?? []).includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggle(current.key, option)}
                    className={cn(
                      "rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
                      active ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface text-muted-foreground",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {current.kind === "singleNum" && (
            <div className="grid grid-cols-3 gap-2">
              {current.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => set(current.key, option as never)}
                  className={cn(
                    "rounded-2xl border py-5 font-display text-lg font-bold transition-colors",
                    value === option ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface text-muted-foreground",
                  )}
                >
                  {option}
                  <span className="block text-[10px] font-medium uppercase tracking-wide">{current.suffix}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] bg-gradient-to-t from-background via-background to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6">
        <button
          type="button"
          disabled={!canAdvance || saving}
          onClick={() => void next()}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {step === STEPS.length - 1 ? "Generate my plan" : "Continue"}
        </button>
      </div>
    </main>
  );
}
