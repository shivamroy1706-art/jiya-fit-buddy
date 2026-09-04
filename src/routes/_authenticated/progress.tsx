import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Footprints, Droplets, Dumbbell, Flame, Scale } from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { useAuth } from "@/lib/auth";
import { todayISO } from "@/lib/app-data";
import { kmFromSteps } from "@/lib/pedometer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress & Charts — AI Fitness Trainer" },
      {
        name: "description",
        content:
          "Track weight trend, kilometres walked, water intake, workout minutes and exercises completed with interactive charts.",
      },
      { property: "og:title", content: "Your Progress" },
      {
        property: "og:description",
        content: "Weight, distance walked, hydration and training volume — all charted.",
      },
    ],
  }),
  component: ProgressPage,
});

const CHART_TOOLTIP = {
  background: "var(--color-surface-alt)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-foreground)",
} as const;

function lastNDays(n: number) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="animate-fade-up rounded-3xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-2 text-xs text-muted-foreground">{text}</p>;
}

function ProgressPage() {
  const { user } = useAuth();
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["progress", user?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      const [metrics, logs, steps, water] = await Promise.all([
        supabase.from("body_metrics_logs").select("date, weight, body_fat").eq("user_id", user!.id).order("date"),
        supabase
          .from("workout_logs")
          .select("date, duration, calories_burned, exercise_ids_completed")
          .eq("user_id", user!.id)
          .order("date"),
        supabase.from("step_logs").select("date, steps").eq("user_id", user!.id).gte("date", since).order("date"),
        supabase.from("water_logs").select("date, ml").eq("user_id", user!.id).gte("date", since).order("date"),
      ]);
      return {
        metrics: metrics.data ?? [],
        logs: logs.data ?? [],
        steps: steps.data ?? [],
        water: water.data ?? [],
      };
    },
    enabled: !!user,
  });

  async function logMetric(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving) return;
    const w = Number(weight);
    if (!w) {
      toast.error("Enter your weight");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("body_metrics_logs").insert({
      user_id: user.id,
      date: todayISO(),
      weight: w,
      body_fat: bodyFat ? Number(bodyFat) : null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setWeight("");
    setBodyFat("");
    toast.success("Measurement saved");
    void refetch();
  }

  const days14 = lastNDays(14);

  const weightData = (data?.metrics ?? []).map((m) => ({ date: m.date.slice(5), weight: m.weight }));
  const bodyFatData = (data?.metrics ?? [])
    .filter((m) => typeof m.body_fat === "number")
    .map((m) => ({ date: m.date.slice(5), body_fat: m.body_fat }));

  const stepMap = new Map((data?.steps ?? []).map((s) => [s.date, s.steps ?? 0]));
  const walkData = days14.map((d) => ({
    date: d.slice(5),
    km: Number(kmFromSteps(stepMap.get(d) ?? 0).toFixed(2)),
    steps: stepMap.get(d) ?? 0,
  }));
  const walkedTotal = walkData.reduce((s, r) => s + r.km, 0);

  const waterMap = new Map<string, number>();
  for (const row of data?.water ?? []) {
    waterMap.set(row.date, (waterMap.get(row.date) ?? 0) + (row.ml ?? 0));
  }
  const waterData = days14.map((d) => ({ date: d.slice(5), litres: Number(((waterMap.get(d) ?? 0) / 1000).toFixed(2)) }));
  const waterAvg = waterData.reduce((s, r) => s + r.litres, 0) / (waterData.length || 1);

  const perDay = new Map<string, { minutes: number; kcal: number; exercises: number; sessions: number }>();
  for (const l of data?.logs ?? []) {
    const key = l.date.slice(0, 10);
    const row = perDay.get(key) ?? { minutes: 0, kcal: 0, exercises: 0, sessions: 0 };
    row.minutes += l.duration ?? 0;
    row.kcal += l.calories_burned ?? 0;
    row.exercises += (l.exercise_ids_completed ?? []).length;
    row.sessions += 1;
    perDay.set(key, row);
  }
  const trainingData = days14.map((d) => {
    const row = perDay.get(d);
    return {
      date: d.slice(5),
      minutes: row?.minutes ?? 0,
      kcal: row?.kcal ?? 0,
      exercises: row?.exercises ?? 0,
    };
  });
  const exercisesTotal = trainingData.reduce((s, r) => s + r.exercises, 0);
  const minutesTotal = trainingData.reduce((s, r) => s + r.minutes, 0);
  const kcalTotal = trainingData.reduce((s, r) => s + r.kcal, 0);

  const stats = [
    { label: "km walked", value: walkedTotal.toFixed(1), icon: <Footprints className="size-3.5" /> },
    { label: "avg L water", value: waterAvg.toFixed(1), icon: <Droplets className="size-3.5" /> },
    { label: "exercises", value: String(exercisesTotal), icon: <Dumbbell className="size-3.5" /> },
    { label: "kcal burned", value: String(kcalTotal), icon: <Flame className="size-3.5" /> },
  ];

  return (
    <main className="app-shell bg-background pb-28">
      <AppHeader title="Progress" />
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 px-4">
          <p className="text-xs text-muted-foreground">Last 14 days</p>

          <section className="grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="animate-fade-up rounded-2xl border border-border bg-surface p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.icon} {s.label}
                </span>
                <p className="mt-1 font-display text-xl font-bold">{s.value}</p>
              </div>
            ))}
          </section>

          <Card title="Weight trend" icon={<Scale className="size-4 text-primary" />}>
            {weightData.length < 2 ? (
              <Empty text="Log at least two measurements to see a trend." />
            ) : (
              <div className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightData}>
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="date" fontSize={11} stroke="currentColor" opacity={0.5} />
                    <YAxis domain={["auto", "auto"]} fontSize={11} stroke="currentColor" opacity={0.5} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Area
                      type="monotone"
                      dataKey="weight"
                      stroke="var(--color-primary)"
                      fill="var(--color-primary)"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Kilometres walked" icon={<Footprints className="size-4 text-primary" />}>
            {walkedTotal === 0 ? (
              <Empty text="Start step tracking on Home to fill this chart." />
            ) : (
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={walkData}>
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="date" fontSize={11} stroke="currentColor" opacity={0.5} />
                    <YAxis fontSize={11} stroke="currentColor" opacity={0.5} unit=" km" width={48} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Area
                      type="monotone"
                      dataKey="km"
                      stroke="var(--color-grade-b)"
                      fill="var(--color-grade-b)"
                      fillOpacity={0.22}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Water intake" icon={<Droplets className="size-4 text-primary" />}>
            {waterAvg === 0 ? (
              <Empty text="Log water on Home to track your hydration." />
            ) : (
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterData}>
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="date" fontSize={11} stroke="currentColor" opacity={0.5} />
                    <YAxis fontSize={11} stroke="currentColor" opacity={0.5} unit=" L" width={44} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Bar dataKey="litres" fill="var(--color-grade-a)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Exercises completed" icon={<Dumbbell className="size-4 text-primary" />}>
            {exercisesTotal === 0 ? (
              <Empty text="Finish a workout to see your exercise volume." />
            ) : (
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trainingData}>
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="date" fontSize={11} stroke="currentColor" opacity={0.5} />
                    <YAxis allowDecimals={false} fontSize={11} stroke="currentColor" opacity={0.5} width={30} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Bar dataKey="exercises" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Workout minutes & calories" icon={<Flame className="size-4 text-primary" />}>
            {minutesTotal === 0 ? (
              <Empty text="No sessions logged yet." />
            ) : (
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trainingData}>
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="date" fontSize={11} stroke="currentColor" opacity={0.5} />
                    <YAxis fontSize={11} stroke="currentColor" opacity={0.5} width={34} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Line type="monotone" dataKey="minutes" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="kcal" stroke="var(--color-grade-d)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {bodyFatData.length >= 2 && (
            <Card title="Body fat %" icon={<Scale className="size-4 text-primary" />}>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bodyFatData}>
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="date" fontSize={11} stroke="currentColor" opacity={0.5} />
                    <YAxis domain={["auto", "auto"]} fontSize={11} stroke="currentColor" opacity={0.5} width={34} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Line type="monotone" dataKey="body_fat" stroke="var(--color-grade-c)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <form onSubmit={logMetric} className="rounded-3xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Log measurement</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
                placeholder="Weight (kg)"
                className="flex-1 rounded-full border border-border bg-surface-alt px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                inputMode="decimal"
                placeholder="Body fat %"
                className="w-28 rounded-full border border-border bg-surface-alt px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="tap mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />} Save
            </button>
          </form>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
