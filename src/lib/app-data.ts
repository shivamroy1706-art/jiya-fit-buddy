import { supabase } from "@/integrations/supabase/client";
import { WEEKDAYS, type Prescription } from "./personalization";

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function weekdayName(d = new Date()) {
  return WEEKDAYS[(d.getDay() + 6) % 7] ?? "Monday";
}

export type PlanDay = {
  id: string;
  day_of_week: string;
  name: string;
  is_rest: boolean;
  prescriptions: Prescription[];
  estimated_duration: number;
  estimated_calories: number;
};

export async function fetchActivePlan(userId: string) {
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id, split_structure, notes, weeks_to_goal")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!plan) return { plan: null, days: [] as PlanDay[] };

  const { data: days } = await supabase
    .from("workout_days")
    .select("id, day_of_week, name, is_rest, prescriptions, estimated_duration, estimated_calories")
    .eq("plan_id", plan.id)
    .order("sort_order");

  return {
    plan,
    days: ((days ?? []) as unknown[]).map((d) => {
      const row = d as Record<string, unknown>;
      return {
        id: row["id"] as string,
        day_of_week: row["day_of_week"] as string,
        name: row["name"] as string,
        is_rest: row["is_rest"] as boolean,
        prescriptions: (row["prescriptions"] as Prescription[]) ?? [],
        estimated_duration: row["estimated_duration"] as number,
        estimated_calories: row["estimated_calories"] as number,
      } satisfies PlanDay;
    }),
  };
}

export async function fetchHomeData(userId: string) {
  const today = todayISO();
  const [profileRes, onboardingRes, planRes, logsRes, waterRes, sleepRes, scansRes] = await Promise.all([
    supabase.from("profiles").select("name, username, xp, streak_days, last_active_date").eq("id", userId).maybeSingle(),
    supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    fetchActivePlan(userId),
    supabase.from("workout_logs").select("id, date, workout_name, duration, calories_burned").eq("user_id", userId).order("date", { ascending: false }).limit(30),
    supabase.from("water_logs").select("ml").eq("user_id", userId).eq("date", today),
    supabase.from("sleep_logs").select("hours").eq("user_id", userId).eq("date", today).maybeSingle(),
    supabase.from("nutrition_scans").select("id, food_name, grade, calories, scanned_at, image_url").eq("user_id", userId).order("scanned_at", { ascending: false }).limit(5),
  ]);

  const logs = logsRes.data ?? [];
  const todaysLog = logs.find((l) => l.date === today) ?? null;
  const waterMl = (waterRes.data ?? []).reduce((s, r) => s + (r.ml ?? 0), 0);
  const dayName = weekdayName();
  const todayPlan = planRes.days.find((d) => d.day_of_week === dayName) ?? null;

  return {
    profile: profileRes.data,
    onboarding: onboardingRes.data,
    plan: planRes.plan,
    days: planRes.days,
    todayPlan,
    todaysLog,
    logs,
    waterMl,
    sleepHours: sleepRes.data?.hours ?? null,
    scans: scansRes.data ?? [],
  };
}

export async function addXp(userId: string, amount: number) {
  const { data } = await supabase.from("profiles").select("xp, streak_days, last_active_date").eq("id", userId).maybeSingle();
  if (!data) return;
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let streak = data.streak_days ?? 0;
  if (data.last_active_date === today) {
    // already counted today
  } else if (data.last_active_date === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }
  await supabase
    .from("profiles")
    .update({ xp: (data.xp ?? 0) + amount, streak_days: streak, last_active_date: today })
    .eq("id", userId);
}
