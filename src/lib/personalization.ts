/**
 * Personalization engine.
 *
 * Everything here is derived from the user's saved onboarding answers:
 * - which exercises are even eligible (equipment + injuries)
 * - how the training week is split (goal + days available)
 * - how many exercises / sets / reps (duration + intensity + level)
 * - nutrition targets (Mifflin-St Jeor BMR x activity factor, goal-adjusted)
 * - an estimated timeline from the goal delta / safe weekly rate
 *
 * Two users with different answers therefore get visibly different plans.
 */

export type ExerciseRow = {
  id: string;
  slug: string;
  name: string;
  muscle_group: string;
  secondary_muscles: string[];
  equipment: string[];
  difficulty: string;
  contraindicated_conditions: string[];
  alternative_slugs: string[];
  is_warmup: boolean;
  met: number;
};

export type OnboardingAnswers = {
  age: number | null;
  gender: string | null;
  height: number | null; // cm
  weight: number | null; // kg
  goal: string | null;
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
  schedule_days: string[];
  schedule_time_block: string | null;
  target_weight?: number | null;
};

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type Prescription = {
  exercise_id: string;
  slug: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
};

export type GeneratedDay = {
  day_of_week: string;
  name: string;
  is_rest: boolean;
  prescriptions: Prescription[];
  estimated_duration: number;
  estimated_calories: number;
};

export type GeneratedPlan = {
  split_structure: string;
  notes: string;
  weeks_to_goal: number | null;
  days: GeneratedDay[];
};

/* ------------------------------ eligibility ------------------------------ */

export function availableEquipment(a: OnboardingAnswers): string[] {
  const set = new Set<string>(["No Equipment"]);
  if (a.workout_location === "Home" || a.workout_location === "Both") {
    a.equipment_home.forEach((e) => set.add(e));
  }
  if (a.workout_location === "Gym" || a.workout_location === "Both") {
    a.equipment_gym.forEach((e) => set.add(e));
    if (a.equipment_gym.includes("Full Gym")) {
      ["Basic Gym", "Free Weights", "Dumbbells", "Bench", "Cable Machine", "Cardio Machines",
        "Power Rack", "Smith Machine", "Pull-up Bar", "Kettlebell", "Treadmill", "Exercise Bike",
      ].forEach((e) => set.add(e));
    }
    if (a.equipment_gym.includes("Basic Gym")) {
      ["Dumbbells", "Bench", "Free Weights"].forEach((e) => set.add(e));
    }
    if (a.equipment_gym.includes("Free Weights")) {
      ["Dumbbells", "Kettlebell"].forEach((e) => set.add(e));
    }
    if (a.equipment_gym.includes("Cardio Machines")) {
      ["Treadmill", "Exercise Bike"].forEach((e) => set.add(e));
    }
  }
  return [...set];
}

const LEVEL_RANK: Record<string, number> = { Beginner: 1, Intermediate: 2, Advanced: 3 };

export function isEligible(ex: ExerciseRow, a: OnboardingAnswers, equipment: string[]) {
  const injuries = a.injuries.filter((i) => i !== "None");
  if (ex.contraindicated_conditions.some((c) => injuries.includes(c))) return false;
  if (ex.equipment.length > 0 && !ex.equipment.some((e) => equipment.includes(e))) return false;
  const userRank = LEVEL_RANK[a.fitness_level ?? "Beginner"] ?? 1;
  if ((LEVEL_RANK[ex.difficulty] ?? 1) > userRank) return false;
  return true;
}

/** Safe replacement for an exercise the user can't or doesn't want to do. */
export function findSubstitute(
  target: ExerciseRow,
  pool: ExerciseRow[],
  a: OnboardingAnswers,
  exclude: string[] = [],
): ExerciseRow | null {
  const equipment = availableEquipment(a);
  const eligible = pool.filter(
    (e) => e.id !== target.id && !exclude.includes(e.id) && isEligible(e, a, equipment) && !e.is_warmup,
  );
  const byAlt = eligible.find((e) => target.alternative_slugs.includes(e.slug));
  if (byAlt) return byAlt;
  const sameGroup = eligible.filter((e) => e.muscle_group === target.muscle_group);
  return sameGroup[0] ?? eligible[0] ?? null;
}

/* --------------------------------- splits -------------------------------- */

type SplitDay = { name: string; groups: string[] };

function splitTemplate(a: OnboardingAnswers): { label: string; days: SplitDay[] } {
  const days = a.days_per_week ?? 3;
  const goal = a.goal ?? "Stay Fit";
  const endurance = goal === "Improve Endurance";

  const FULL: SplitDay = { name: "Full Body", groups: ["Chest", "Back", "Quads", "Shoulders", "Abs"] };
  const UPPER: SplitDay = { name: "Upper Body Strength", groups: ["Chest", "Back", "Shoulders", "Biceps", "Triceps"] };
  const LOWER: SplitDay = { name: "Lower Body Power", groups: ["Quads", "Hamstrings", "Glutes", "Calves"] };
  const PUSH: SplitDay = { name: "Push Day", groups: ["Chest", "Shoulders", "Triceps"] };
  const PULL: SplitDay = { name: "Pull Day", groups: ["Back", "Biceps", "Forearms"] };
  const LEGS: SplitDay = { name: "Leg Day", groups: ["Quads", "Hamstrings", "Glutes", "Calves"] };
  const CORE: SplitDay = { name: "Core & Conditioning", groups: ["Abs", "Full Body"] };
  const CARDIO: SplitDay = { name: "Cardio & Endurance", groups: ["Full Body", "Abs"] };
  const ARMS: SplitDay = { name: "Arms & Shoulders", groups: ["Biceps", "Triceps", "Shoulders", "Forearms"] };

  if (endurance) {
    const rotation = [CARDIO, FULL, CARDIO, CORE, FULL, CARDIO, CORE];
    return { label: `Endurance circuit · ${days} days/week`, days: rotation.slice(0, days) };
  }

  if (days <= 2) return { label: `Full-body split · ${days} days/week`, days: [FULL, { ...FULL, name: "Full Body B" }].slice(0, days) };
  if (days === 3) {
    if (goal === "Lose Weight") return { label: "Full body + conditioning · 3 days/week", days: [FULL, CARDIO, { ...FULL, name: "Full Body B" }] };
    return { label: "Push / Pull / Legs · 3 days/week", days: [PUSH, PULL, LEGS] };
  }
  if (days === 4) return { label: "Upper / Lower · 4 days/week", days: [UPPER, LOWER, { ...UPPER, name: "Upper Body Hypertrophy" }, { ...LOWER, name: "Lower Body Volume" }] };
  if (days === 5) return { label: "Push / Pull / Legs + Upper / Core · 5 days/week", days: [PUSH, PULL, LEGS, UPPER, CORE] };
  if (days === 6) return { label: "Push / Pull / Legs ×2 · 6 days/week", days: [PUSH, PULL, LEGS, { ...PUSH, name: "Push Day B" }, { ...PULL, name: "Pull Day B" }, { ...LEGS, name: "Leg Day B" }] };
  return { label: "PPL + Arms + Core · 7 days/week", days: [PUSH, PULL, LEGS, ARMS, CORE, UPPER, CARDIO] };
}

function volumeFor(a: OnboardingAnswers) {
  const duration = a.session_duration ?? 45;
  const exerciseCount = duration <= 15 ? 3 : duration <= 30 ? 4 : duration <= 45 ? 6 : duration <= 60 ? 7 : 9;

  const intensity = a.intensity ?? "Moderate";
  const setsByIntensity: Record<string, number> = { Easy: 2, Moderate: 3, Hard: 4, Intense: 5 };
  const sets = setsByIntensity[intensity] ?? 3;

  const goal = a.goal ?? "Stay Fit";
  let reps = "3 sets x 12 reps";
  let rest = 60;
  if (goal === "Gain Strength") {
    reps = "5 reps";
    rest = 150;
  } else if (goal === "Build Muscle") {
    reps = "10 reps";
    rest = 90;
  } else if (goal === "Lose Weight") {
    reps = "15 reps";
    rest = 45;
  } else if (goal === "Improve Endurance") {
    reps = "20 reps";
    rest = 30;
  } else if (goal === "Athletic Performance") {
    reps = "8 reps";
    rest = 75;
  } else {
    reps = "12 reps";
    rest = 60;
  }
  const intensityRest: Record<string, number> = { Easy: 20, Moderate: 0, Hard: -10, Intense: -15 };
  rest = Math.max(20, rest + (intensityRest[intensity] ?? 0));

  return { exerciseCount, sets, reps, rest };
}

/* ------------------------------ plan builder ----------------------------- */

export function generatePlan(a: OnboardingAnswers, allExercises: ExerciseRow[]): GeneratedPlan {
  const equipment = availableEquipment(a);
  const pool = allExercises.filter((e) => !e.is_warmup && isEligible(e, a, equipment));
  const { label, days: template } = splitTemplate(a);
  const { exerciseCount, sets, reps, rest } = volumeFor(a);

  const focus = a.focus_muscles.filter((m) => m !== "Full Body");
  const desiredMap: Record<string, string> = {
    "Bigger Chest": "Chest",
    "Bigger Arms": "Biceps",
    "Wider Shoulders": "Shoulders",
    "Bigger Back": "Back",
    "Bigger Legs": "Quads",
    "Bigger Glutes": "Glutes",
    "Six-Pack Abs": "Abs",
    "Better Posture": "Back",
    "Better Stamina": "Full Body",
  };
  const desiredGroups = a.desired_results.map((r) => desiredMap[r]).filter(Boolean) as string[];
  const priority = new Set([...focus, ...desiredGroups]);

  const scheduled = a.schedule_days.length > 0 ? a.schedule_days : WEEKDAYS.slice(0, a.days_per_week ?? 3);
  const orderedTraining = WEEKDAYS.filter((d) => scheduled.includes(d));
  const trainingDays = orderedTraining.length > 0 ? orderedTraining : WEEKDAYS.slice(0, template.length);

  const days: GeneratedDay[] = [];
  let templateIndex = 0;

  for (const weekday of WEEKDAYS) {
    if (!trainingDays.includes(weekday)) {
      days.push({
        day_of_week: weekday,
        name: "Active Recovery",
        is_rest: true,
        prescriptions: [],
        estimated_duration: 15,
        estimated_calories: 60,
      });
      continue;
    }

    const tpl = template[templateIndex % template.length];
    templateIndex += 1;

    // Rank candidates: matches the day's target groups first, priority groups boosted.
    const candidates = pool
      .map((ex) => {
        let score = 0;
        if (tpl.groups.includes(ex.muscle_group)) score += 10;
        if (ex.secondary_muscles.some((m) => tpl.groups.includes(m))) score += 3;
        if (priority.has(ex.muscle_group)) score += 6;
        if (ex.secondary_muscles.some((m) => priority.has(m))) score += 2;
        if (a.fitness_level === "Advanced" && ex.difficulty === "Advanced") score += 2;
        if (a.fitness_level === "Beginner" && ex.difficulty === "Beginner") score += 2;
        return { ex, score };
      })
      .filter((c) => c.score > 0)
      .sort((x, y) => y.score - x.score);

    const picked: ExerciseRow[] = [];
    const usedGroups = new Map<string, number>();
    for (const { ex } of candidates) {
      if (picked.length >= exerciseCount) break;
      const count = usedGroups.get(ex.muscle_group) ?? 0;
      const cap = priority.has(ex.muscle_group) ? 3 : 2;
      if (count >= cap) continue;
      picked.push(ex);
      usedGroups.set(ex.muscle_group, count + 1);
    }
    // Top up if the filters were too strict.
    for (const ex of pool) {
      if (picked.length >= exerciseCount) break;
      if (!picked.includes(ex)) picked.push(ex);
    }

    const duration = a.session_duration ?? 45;
    const weight = a.weight ?? 70;
    const avgMet = picked.reduce((s, e) => s + Number(e.met || 5), 0) / Math.max(picked.length, 1);
    const calories = Math.round((avgMet * 3.5 * weight) / 200 * duration);

    days.push({
      day_of_week: weekday,
      name: tpl.name,
      is_rest: false,
      prescriptions: picked.map((ex) => ({
        exercise_id: ex.id,
        slug: ex.slug,
        name: ex.name,
        sets,
        reps,
        rest_seconds: rest,
      })),
      estimated_duration: duration,
      estimated_calories: calories,
    });
  }

  const injuries = a.injuries.filter((i) => i !== "None");
  const notes = [
    `Built for your goal: ${a.goal ?? "general fitness"}.`,
    `${a.fitness_level ?? "Beginner"} level, ${a.intensity ?? "Moderate"} intensity, ${a.session_duration ?? 45} min sessions.`,
    priority.size > 0 ? `Extra volume on: ${[...priority].join(", ")}.` : "",
    injuries.length > 0 ? `Exercises unsafe for ${injuries.join(", ")} were removed and replaced.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { split_structure: label, notes, weeks_to_goal: estimateWeeks(a), days };
}

/* ------------------------------- nutrition ------------------------------- */

export function bmr(a: OnboardingAnswers): number {
  const w = a.weight ?? 70;
  const h = a.height ?? 170;
  const age = a.age ?? 30;
  const base = 10 * w + 6.25 * h - 5 * age;
  return Math.round(a.gender === "Female" ? base - 161 : base + 5);
}

export function activityFactor(a: OnboardingAnswers): number {
  const days = a.days_per_week ?? 3;
  const intensityBump: Record<string, number> = { Easy: 0, Moderate: 0.03, Hard: 0.06, Intense: 0.09 };
  const base = days <= 2 ? 1.375 : days <= 4 ? 1.55 : days <= 6 ? 1.725 : 1.9;
  return base + (intensityBump[a.intensity ?? "Moderate"] ?? 0);
}

export function nutritionTargets(a: OnboardingAnswers) {
  const tdee = Math.round(bmr(a) * activityFactor(a));
  const goal = a.goal ?? "Stay Fit";
  const adjust: Record<string, number> = {
    "Lose Weight": -0.2,
    "Build Muscle": 0.12,
    "Gain Strength": 0.1,
    "Improve Endurance": 0.05,
    "Stay Fit": 0,
    "Athletic Performance": 0.08,
  };
  const calories = Math.round(tdee * (1 + (adjust[goal] ?? 0)));
  const weight = a.weight ?? 70;

  const proteinPerKg = goal === "Build Muscle" || goal === "Gain Strength" ? 2.0 : goal === "Lose Weight" ? 1.8 : 1.6;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((calories * (goal === "Lose Weight" ? 0.27 : 0.25)) / 9);
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { tdee, calories, protein, carbs, fat };
}

export function estimateWeeks(a: OnboardingAnswers): number | null {
  const goal = a.goal ?? "";
  const current = a.weight ?? null;
  const target = a.target_weight ?? null;
  if (goal === "Lose Weight") {
    const delta = target && current ? Math.abs(current - target) : 8;
    return Math.max(4, Math.ceil(delta / 0.6)); // ~0.6 kg/week safe rate
  }
  if (goal === "Build Muscle" || goal === "Gain Strength") {
    const delta = target && current ? Math.abs(target - current) : 5;
    return Math.max(8, Math.ceil(delta / 0.25)); // ~0.25 kg lean/week
  }
  return 12;
}

/** Progressive overload: bump sets/reps based on how many weeks have been logged. */
export function overloadHint(weeksTrained: number, reps: string): string {
  if (weeksTrained < 2) return reps;
  const steps = Math.floor(weeksTrained / 2);
  const match = reps.match(/(\d+)/);
  if (!match) return reps;
  const base = Number(match[1]);
  const bumped = Math.min(base + steps, base + 6);
  return reps.replace(/\d+/, String(bumped));
}

export function levelFromXp(xp: number) {
  const level = Math.max(1, Math.floor(xp / 300) + 1);
  const titles = [
    "Rookie", "Starter", "Mover", "Grinder", "Challenger",
    "Athlete", "Contender", "Fit Warrior", "Beast", "Elite", "Legend",
  ];
  const title = titles[Math.min(level - 1, titles.length - 1)] ?? "Legend";
  const into = xp % 300;
  return { level, title, into, next: 300, floor: (level - 1) * 300, ceiling: level * 300 };
}
