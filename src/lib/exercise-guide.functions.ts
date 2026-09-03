import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1).max(120),
  sets: z.number().int().min(1).max(12),
  reps: z.string().min(1).max(40),
});

export type ExerciseGuide = {
  setup: string[];
  steps: string[];
  breathing: string;
  cues: string[];
  mistakes: string[];
  tempo_seconds_per_rep: number;
  target_muscles: string;
};

const FALLBACK = (name: string): ExerciseGuide => ({
  setup: [`Clear space and set up for ${name}.`, "Brace your core and keep a neutral spine."],
  steps: [
    "Move under control through the full range you can manage pain-free.",
    "Pause briefly at the hardest point.",
    "Return to the start slowly, keeping tension on the muscle.",
  ],
  breathing: "Inhale on the way down, exhale as you push or pull.",
  cues: ["Slow and controlled beats heavy and sloppy.", "Stop 1–2 reps before failure on your first sets."],
  mistakes: ["Rushing the reps", "Losing core tension"],
  tempo_seconds_per_rep: 3,
  target_muscles: "Primary movers for this exercise",
});

/** Jiya's how-to guide for a single exercise. */
export const getExerciseGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }): Promise<ExerciseGuide> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return FALLBACK(data.name);

    const { data: onboarding } = await context.supabase
      .from("user_profiles")
      .select("injuries, fitness_level, workout_location")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const shape = z.object({
      setup: z.array(z.string()).min(1).max(4),
      steps: z.array(z.string()).min(3).max(7),
      breathing: z.string(),
      cues: z.array(z.string()).min(2).max(4),
      mistakes: z.array(z.string()).min(2).max(4),
      tempo_seconds_per_rep: z.number(),
      target_muscles: z.string(),
    });

    try {
      const result = await generateObject({
        model: gateway("google/gemini-3.6-flash"),
        schema: shape,
        prompt: `You are Jiya, an expert female fitness coach. Explain how to perform "${data.name}" (prescribed ${data.sets} sets of ${data.reps}).
Trainee level: ${onboarding?.["fitness_level"] ?? "Beginner"}. Training at: ${onboarding?.["workout_location"] ?? "Home"}.
Injuries/conditions to respect: ${JSON.stringify(onboarding?.["injuries"] ?? [])}.
Write short, second-person, actionable lines (max ~18 words each). tempo_seconds_per_rep is the realistic total seconds for one controlled rep (2-6).`,
      });
      return result.object as ExerciseGuide;
    } catch {
      return FALLBACK(data.name);
    }
  });
