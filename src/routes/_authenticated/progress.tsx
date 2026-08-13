import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { useAuth } from "@/lib/auth";
import { todayISO } from "@/lib/app-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress & Charts — AI Fitness Trainer" },
      {
        name: "description",
        content: "Track weight trend, body fat and weekly workout volume with interactive charts.",
      },
      { property: "og:title", content: "Your Progress" },
      { property: "og:description", content: "Weight trend, body composition and workout volume charts." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { user } = useAuth();
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["progress", user?.id],
    queryFn: async () => {
      const [metrics, logs] = await Promise.all([
        supabase
          .from("body_metrics_logs")
          .select("date, weight, body_fat")
          .eq("user_id", user!.id)
          .order("date"),
        supabase
          .from("workout_logs")
          .select("date, duration, calories_burned")
          .eq("user_id", user!.id)
          .order("date"),
      ]);
      return { metrics: metrics.data ?? [], logs: logs.data ?? [] };
    },
    enabled: !!user,
  });

  async function logMetric(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const w = Number(weight);
    if (!w) {
      toast.error("Enter your weight");
      return;
    }
    const { error } = await supabase.from("body_metrics_logs").insert({
      user_id: user.id,
      date: todayISO(),
      weight: w,
      body_fat: bodyFat ? Number(bodyFat) : null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setWeight("");
    setBodyFat("");
    toast.success("Measurement saved");
    void refetch();
  }

  const weightData = (data?.metrics ?? []).map((m) => ({ date: m.date.slice(5), weight: m.weight }));
  const volume = Object.values(
    (data?.logs ?? []).reduce<Record<string, { date: string; minutes: number; kcal: number }>>((acc, l) => {
      const key = l.date.slice(0, 10);
      const row = acc[key] ?? { date: key.slice(5), minutes: 0, kcal: 0 };
      row.minutes += l.duration ?? 0;
      row.kcal += l.calories_burned ?? 0;
      acc[key] = row;
      return acc;
    }, {}),
  ).slice(-14);

  return (
    <main className="app-shell bg-background pb-28">
      <AppHeader title="Progress" />
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 px-4">
          <section className="rounded-3xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Weight trend</h2>
            {weightData.length < 2 ? (
              <p className="mt-2 text-xs text-muted-foreground">Log at least two measurements to see a trend.</p>
            ) : (
              <div className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightData}>
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="date" fontSize={11} stroke="currentColor" opacity={0.5} />
                    <YAxis domain={["auto", "auto"]} fontSize={11} stroke="currentColor" opacity={0.5} />
                    <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "none", borderRadius: 12 }} />
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
          </section>

          <section className="rounded-3xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Workout minutes</h2>
            {volume.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No sessions logged yet.</p>
            ) : (
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volume}>
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="date" fontSize={11} stroke="currentColor" opacity={0.5} />
                    <YAxis fontSize={11} stroke="currentColor" opacity={0.5} />
                    <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "none", borderRadius: 12 }} />
                    <Bar dataKey="minutes" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

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
            <button type="submit" className="mt-3 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
              Save
            </button>
          </form>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
