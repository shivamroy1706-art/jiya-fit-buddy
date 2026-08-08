import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskSchema = z.object({ message: z.string().min(1).max(4000) });

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Jiya — the AI coach.
 * Persists the user turn, builds a live-data context block plus the FULL prior
 * conversation, calls the model, persists and returns her reply.
 */
export const askJiya = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    // 1. persist the user's message
    const { error: insertErr } = await supabase
      .from("chat_messages")
      .insert({ user_id: userId, sender: "user", message: data.message });
    if (insertErr) throw new Error(insertErr.message);

    // 2. gather live user data
    const today = new Date();
    const todayName = WEEKDAYS[today.getDay()] ?? "Monday";
    const tomorrowName = WEEKDAYS[(today.getDay() + 1) % 7] ?? "Tuesday";

    const [profileRes, onboardingRes, planRes, historyRes, logsRes, scansRes] = await Promise.all([
      supabase.from("profiles").select("name, username, xp, streak_days").eq("id", userId).maybeSingle(),
      supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("workout_plans").select("id, split_structure, notes, weeks_to_goal").eq("user_id", userId).eq("active", true).maybeSingle(),
      supabase.from("chat_messages").select("sender, message").eq("user_id", userId).order("created_at", { ascending: true }).limit(80),
      supabase.from("workout_logs").select("date, workout_name, duration, calories_burned").eq("user_id", userId).order("date", { ascending: false }).limit(8),
      supabase.from("nutrition_scans").select("food_name, grade, calories, summary").eq("user_id", userId).order("scanned_at", { ascending: false }).limit(6),
    ]);

    let days: Array<Record<string, unknown>> = [];
    if (planRes.data?.id) {
      const { data: dayRows } = await supabase
        .from("workout_days")
        .select("day_of_week, name, is_rest, prescriptions, estimated_duration, estimated_calories")
        .eq("plan_id", planRes.data.id)
        .order("sort_order");
      days = (dayRows ?? []) as Array<Record<string, unknown>>;
    }

    const profile = profileRes.data;
    const onboarding = onboardingRes.data as Record<string, unknown> | null;
    const firstName = (profile?.name ?? "there").split(" ")[0];

    const liveContext = {
      first_name: firstName,
      username: profile?.username ?? null,
      xp: profile?.xp ?? 0,
      streak_days: profile?.streak_days ?? 0,
      today_is: todayName,
      tomorrow_is: tomorrowName,
      goal: onboarding?.["goal"] ?? null,
      fitness_level: onboarding?.["fitness_level"] ?? null,
      intensity: onboarding?.["intensity"] ?? null,
      days_per_week: onboarding?.["days_per_week"] ?? null,
      session_duration_minutes: onboarding?.["session_duration"] ?? null,
      injuries: onboarding?.["injuries"] ?? [],
      equipment_home: onboarding?.["equipment_home"] ?? [],
      equipment_gym: onboarding?.["equipment_gym"] ?? [],
      workout_location: onboarding?.["workout_location"] ?? null,
      focus_muscles: onboarding?.["focus_muscles"] ?? [],
      nutrition_targets: {
        calories: onboarding?.["daily_calories"] ?? null,
        protein_g: onboarding?.["protein_g"] ?? null,
        carbs_g: onboarding?.["carbs_g"] ?? null,
        fat_g: onboarding?.["fat_g"] ?? null,
      },
      plan_split: planRes.data?.split_structure ?? null,
      weekly_schedule: days.map((d) => ({
        day: d["day_of_week"],
        workout: d["is_rest"] ? "Active Recovery / rest day" : d["name"],
        exercises: d["is_rest"]
          ? []
          : ((d["prescriptions"] as Array<{ name: string; sets: number; reps: string }>) ?? []).map(
              (p) => `${p.name} — ${p.sets} sets x ${p.reps}`,
            ),
      })),
      recent_workouts: logsRes.data ?? [],
      recent_scans: scansRes.data ?? [],
    };

    const systemPrompt = `You are Jiya, a warm, motivating and knowledgeable female AI fitness coach inside the "AI Fitness Trainer" app.

How you behave:
- Be encouraging, personal and concise. Use the user's first name naturally. Occasionally use one tasteful emoji.
- Answer general exercise questions accurately: form cues, muscles worked, sets/reps guidance, safety.
- When asked "how do I do X", give clear numbered step-by-step form instructions, then mention they can open the exercise's How-To page in the app if it exists.
- When asked about upcoming or future workouts ("what's my workout tomorrow", "what's next this week"), read weekly_schedule in USER_DATA and report it EXACTLY. Never invent a workout. Today is ${todayName}; tomorrow is ${tomorrowName}.
- If asked to change today's plan (swap an exercise, make it easier, missing equipment), suggest a specific safe alternative that respects their listed equipment and injuries, and tell them to tap the exercise row → "Swap exercise" to apply it, or that you have noted the substitution.
- Answer nutrition questions and reference their nutrition targets and recent scans when relevant.
- Never give medical diagnoses. For pain, injury or medical concerns, be kind and recommend seeing a qualified professional.
- Anything far outside fitness, nutrition, motivation or the app: answer briefly and warmly, then steer back to their training.
- Use markdown (short paragraphs, bold, lists). Keep replies under ~200 words unless step-by-step instructions are needed.

USER_DATA (live, authoritative — always prefer this over assumptions):
${JSON.stringify(liveContext)}`;

    const history = (historyRes.data ?? []) as Array<{ sender: string; message: string }>;
    const messages = history.map((m) => ({
      role: m.sender === "jiya" ? ("assistant" as const) : ("user" as const),
      content: m.message,
    }));
    if (messages.length === 0) {
      messages.push({ role: "user" as const, content: data.message });
    }

    const { streamText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    let reply = "";
    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        system: systemPrompt,
        messages,
      });
      reply = (await result.text).trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("429")) throw new Error("Jiya is getting a lot of questions right now. Please try again in a moment.");
      if (message.includes("402")) throw new Error("AI credits have run out for this workspace.");
      throw new Error("Jiya couldn't connect. Tap retry to try again.");
    }

    if (!reply) reply = "I'm here! Could you say that again for me?";

    const { data: saved, error: saveErr } = await supabase
      .from("chat_messages")
      .insert({ user_id: userId, sender: "jiya", message: reply })
      .select("id, message, created_at")
      .single();
    if (saveErr) throw new Error(saveErr.message);

    return { id: saved.id, message: saved.message, created_at: saved.created_at };
  });

/** Retry a failed reply without re-inserting the user message. */
export const retryJiya = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: last } = await supabase
      .from("chat_messages")
      .select("message, sender")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last || last.sender !== "user") throw new Error("Nothing to retry");
    await supabase.from("chat_messages").delete().eq("user_id", userId).eq("sender", "user").eq("message", last.message).order("created_at", { ascending: false }).limit(1);
    return { message: last.message };
  });
