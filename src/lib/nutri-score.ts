export type Grade = "A" | "B" | "C" | "D" | "E";

export const GRADE_MEANING: Record<Grade, string> = {
  A: "Good — eat freely",
  B: "Good — solid choice",
  C: "Average — okay sometimes",
  D: "Bad — limit this",
  E: "Very bad — avoid",
};

export const GRADE_CLASS: Record<Grade, string> = {
  A: "bg-primary/20 text-primary",
  B: "bg-primary/15 text-primary",
  C: "bg-amber-500/15 text-amber-500",
  D: "bg-orange-500/15 text-orange-500",
  E: "bg-destructive/15 text-destructive",
};

export function normalizeGrade(value: string | null | undefined): Grade | null {
  const g = (value ?? "").trim().toUpperCase();
  return g === "A" || g === "B" || g === "C" || g === "D" || g === "E" ? g : null;
}

type Nutrients = {
  energyKcal?: number | null;
  sugars?: number | null;
  saturatedFat?: number | null;
  salt?: number | null;
  sodium?: number | null;
  fiber?: number | null;
  protein?: number | null;
};

function points(value: number, thresholds: number[]) {
  let p = 0;
  for (const t of thresholds) if (value > t) p += 1;
  return p;
}

/** Nutri-Score style grade per 100 g, used when the food database has no grade. */
export function computeGrade(n: Nutrients): Grade | null {
  const kj = n.energyKcal != null ? n.energyKcal * 4.184 : null;
  const salt = n.salt ?? (n.sodium != null ? n.sodium * 2.5 : null);
  if (kj == null && n.sugars == null && n.saturatedFat == null && salt == null) return null;

  const negative =
    points(kj ?? 0, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]) +
    points(n.sugars ?? 0, [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]) +
    points(n.saturatedFat ?? 0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
    points((salt ?? 0) * 1000, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);

  const fiberPts = points(n.fiber ?? 0, [0.9, 1.9, 2.8, 3.7, 4.7]);
  const proteinPts = points(n.protein ?? 0, [1.6, 3.2, 4.8, 6.4, 8]);
  const positive = fiberPts + proteinPts;

  const score = negative >= 11 && proteinPts < 5 ? negative - fiberPts : negative - positive;

  if (score <= -1) return "A";
  if (score <= 2) return "B";
  if (score <= 10) return "C";
  if (score <= 18) return "D";
  return "E";
}
