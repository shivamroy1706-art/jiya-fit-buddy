import { supabase } from "@/integrations/supabase/client";

export type PlanHealth = {
  generatedOn: string | null;
  weeksOld: number;
  startWeight: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
  progressPct: number;
  goalReached: boolean;
  shouldRegenerate: boolean;
  reason: string;
};

const WEEK_MS = 7 * 86400000;

export async function fetchPlanHealth(userId: string): Promise<PlanHealth> {
  const [planRes, profileRes, metricsRes] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("generated_on")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle(),
    supabase.from("user_profiles").select("weight, target_weight, goal").eq("user_id", userId).maybeSingle(),
    supabase.from("body_metrics_logs").select("date, weight").eq("user_id", userId).order("date"),
  ]);

  const generatedOn = planRes.data?.generated_on ?? null;
  const weeksOld = generatedOn ? Math.floor((Date.now() - new Date(generatedOn).getTime()) / WEEK_MS) : 0;

  const metrics = (metricsRes.data ?? []).filter((m) => typeof m.weight === "number");
  const startWeight = profileRes.data?.weight ?? metrics[0]?.weight ?? null;
  const currentWeight = metrics.length > 0 ? (metrics[metrics.length - 1]?.weight ?? null) : startWeight;
  const targetWeight = profileRes.data?.target_weight ?? null;

  let progressPct = 0;
  let goalReached = false;
  if (startWeight && targetWeight && currentWeight && Math.abs(targetWeight - startWeight) > 0.5) {
    const total = targetWeight - startWeight;
    const moved = currentWeight - startWeight;
    progressPct = Math.max(0, Math.min(100, Math.round((moved / total) * 100)));
    goalReached = progressPct >= 100;
  }

  const drift = startWeight && currentWeight ? Math.abs(currentWeight - startWeight) : 0;

  let shouldRegenerate = false;
  let reason = "Your plan is fresh and matched to your current numbers.";
  if (goalReached) {
    shouldRegenerate = true;
    reason = "You hit your target weight — time for a new plan and new targets.";
  } else if (weeksOld >= 4) {
    shouldRegenerate = true;
    reason = `Your plan is ${weeksOld} weeks old. Progressive overload works best with a refresh every 4 weeks.`;
  } else if (drift >= 3) {
    shouldRegenerate = true;
    reason = `Your weight moved ${drift.toFixed(1)} kg since this plan was built — your calories and volume should be recalculated.`;
  } else if (weeksOld >= 1) {
    reason = `Week ${weeksOld + 1} of this plan. Keep going — refresh recommended at 4 weeks.`;
  }

  return {
    generatedOn,
    weeksOld,
    startWeight,
    currentWeight,
    targetWeight,
    progressPct,
    goalReached,
    shouldRegenerate,
    reason,
  };
}
