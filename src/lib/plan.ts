import { supabase } from "@/integrations/supabase/client";
import {
  generatePlan,
  nutritionTargets,
  type ExerciseRow,
  type OnboardingAnswers,
} from "./personalization";

export async function fetchExercises(): Promise<ExerciseRow[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "id, slug, name, muscle_group, secondary_muscles, equipment, difficulty, contraindicated_conditions, alternative_slugs, is_warmup, met",
    )
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExerciseRow[];
}

export function toAnswers(row: Record<string, unknown>): OnboardingAnswers {
  return {
    age: (row["age"] as number) ?? null,
    gender: (row["gender"] as string) ?? null,
    height: (row["height"] as number) ?? null,
    weight: (row["weight"] as number) ?? null,
    goal: (row["goal"] as string) ?? null,
    workout_location: (row["workout_location"] as string) ?? null,
    equipment_home: (row["equipment_home"] as string[]) ?? [],
    equipment_gym: (row["equipment_gym"] as string[]) ?? [],
    desired_results: (row["desired_results"] as string[]) ?? [],
    planning_style: (row["planning_style"] as string) ?? null,
    focus_muscles: (row["focus_muscles"] as string[]) ?? [],
    fitness_level: (row["fitness_level"] as string) ?? null,
    intensity: (row["intensity"] as string) ?? null,
    past_experience: (row["past_experience"] as string) ?? null,
    days_per_week: (row["days_per_week"] as number) ?? null,
    session_duration: (row["session_duration"] as number) ?? null,
    injuries: (row["injuries"] as string[]) ?? [],
    schedule_days: (row["schedule_days"] as string[]) ?? [],
    schedule_time_block: (row["schedule_time_block"] as string) ?? null,
    target_weight: (row["target_weight"] as number) ?? null,
  };
}

/**
 * Regenerates and persists the active plan + nutrition targets for a user.
 * Called after onboarding and after ANY profile edit.
 */
export async function regeneratePlan(userId: string) {
  const [{ data: profileRow, error: pErr }, exercises] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    fetchExercises(),
  ]);
  if (pErr) throw pErr;
  if (!profileRow) throw new Error("Profile not found");

  const answers = toAnswers(profileRow as Record<string, unknown>);
  const plan = generatePlan(answers, exercises);
  const targets = nutritionTargets(answers);

  await supabase.from("workout_plans").update({ active: false }).eq("user_id", userId).eq("active", true);

  const { data: planRow, error: planErr } = await supabase
    .from("workout_plans")
    .insert({
      user_id: userId,
      split_structure: plan.split_structure,
      notes: plan.notes,
      weeks_to_goal: plan.weeks_to_goal,
      active: true,
    })
    .select("id")
    .single();
  if (planErr) throw planErr;

  const rows = plan.days.map((d, i) => ({
    plan_id: planRow.id,
    user_id: userId,
    day_of_week: d.day_of_week,
    name: d.name,
    is_rest: d.is_rest,
    exercise_ids: d.prescriptions.map((p) => p.exercise_id),
    prescriptions: d.prescriptions,
    estimated_duration: d.estimated_duration,
    estimated_calories: d.estimated_calories,
    sort_order: i,
  }));
  const { error: daysErr } = await supabase.from("workout_days").insert(rows);
  if (daysErr) throw daysErr;

  const { error: targetErr } = await supabase
    .from("user_profiles")
    .update({
      daily_calories: targets.calories,
      protein_g: targets.protein,
      carbs_g: targets.carbs,
      fat_g: targets.fat,
    })
    .eq("user_id", userId);
  if (targetErr) throw targetErr;

  return { planId: planRow.id, plan, targets };
}
