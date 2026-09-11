import { useEffect, useRef, useState } from "react";
import { Footprints, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/app-data";
import {
  caloriesFromSteps,
  isPedometerSupported,
  kmFromSteps,
  requestMotionPermission,
  startPedometer,
} from "@/lib/pedometer";

type Props = {
  userId: string;
  initialSteps: number;
  weightKg?: number | null;
  goal?: number;
};

export function StepsCard({ userId, initialSteps, weightKg, goal = 8000 }: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [tracking, setTracking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const stepsRef = useRef(initialSteps);
  const savingRef = useRef(false);

  useEffect(() => {
    setSupported(isPedometerSupported());
  }, []);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => () => stopRef.current?.(), []);

  async function persist(total: number) {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await supabase
        .from("step_logs")
        .upsert(
          { user_id: userId, date: todayISO(), steps: total, updated_at: new Date().toISOString() },
          { onConflict: "user_id,date" },
        );
    } finally {
      savingRef.current = false;
    }
  }

  async function toggle() {
    if (tracking) {
      stopRef.current?.();
      stopRef.current = null;
      setTracking(false);
      void persist(stepsRef.current);
      return;
    }

    setError(null);
    const ok = await requestMotionPermission();
    if (!ok) {
      setError("Motion access was blocked. Enable motion & orientation access in your browser settings.");
      return;
    }

    let sinceSave = 0;
    stopRef.current = startPedometer({
      onSteps: (delta) => {
        setSteps((prev) => prev + delta);
        sinceSave += delta;
        if (sinceSave >= 25) {
          sinceSave = 0;
          void persist(stepsRef.current);
        }
      },
    });
    setTracking(true);
  }

  const pct = Math.min(100, (steps / goal) * 100);

  return (
    <section className="rounded-3xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Footprints className="size-4 text-primary" /> Steps today
        </div>
        <span className="text-xs text-muted-foreground">
          {steps.toLocaleString()} / {goal.toLocaleString()}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Distance" value={`${kmFromSteps(steps).toFixed(2)} km`} />
        <Metric label="Burned" value={`${caloriesFromSteps(steps, weightKg ?? 70)} kcal`} />
        <Metric label="Goal" value={`${Math.round(pct)}%`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {supported ? (
          <button
            type="button"
            onClick={() => void toggle()}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-4 py-1.5 text-xs font-semibold text-primary"
          >
            {tracking ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {tracking ? "Pause step tracking" : "Track my steps"}
          </button>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Step tracking needs a phone with motion sensors — open the app on your phone to count steps.
          </p>
        )}
        <button
          type="button"
          onClick={() => setShowMap((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-4 py-1.5 text-xs font-semibold text-primary"
        >
          <MapIcon className="size-3.5" />
          {showMap ? "Hide map" : "Map"}
        </button>
      </div>

      {showMap && (
        <ClientOnly>
          <Suspense
            fallback={
              <div className="mt-3 flex h-56 items-center justify-center rounded-2xl border border-border bg-surface-alt">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            }
          >
            <WalkMap userId={userId} />
          </Suspense>
        </ClientOnly>
      )}

      {tracking && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Counting while the app is open. Keep this screen on in your pocket for best accuracy.
        </p>
      )}
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-alt p-2.5">
      <p className="font-display text-sm font-bold text-primary">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
