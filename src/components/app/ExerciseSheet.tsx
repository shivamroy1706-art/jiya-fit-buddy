import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { getExerciseGuide } from "@/lib/exercise-guide.functions";
import type { Prescription } from "@/lib/personalization";
import { cn } from "@/lib/utils";

type Props = {
  prescription: Prescription;
  onClose: () => void;
  onComplete: () => void;
  onSwap: () => void;
  swapping?: boolean;
};

function repCount(reps: string) {
  const nums = reps.match(/\d+/g);
  if (!nums || nums.length === 0) return 10;
  const last = Number(nums[nums.length - 1]);
  return Number.isFinite(last) ? last : 10;
}

function mmss(total: number) {
  const m = Math.floor(Math.max(0, total) / 60);
  const s = Math.max(0, total) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ExerciseSheet({ prescription, onClose, onComplete, onSwap, swapping }: Props) {
  const fetchGuide = useServerFn(getExerciseGuide);
  const { data: guide, isLoading } = useQuery({
    queryKey: ["exercise-guide", prescription.slug],
    queryFn: () =>
      fetchGuide({
        data: { name: prescription.name, sets: prescription.sets, reps: prescription.reps },
      }),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const isTimed = /s|sec|min/i.test(prescription.reps) && !/rep/i.test(prescription.reps);
  const tempo = guide?.tempo_seconds_per_rep && guide.tempo_seconds_per_rep > 1 ? guide.tempo_seconds_per_rep : 3;
  const workSeconds = useMemo(
    () => (isTimed ? repCount(prescription.reps) : Math.round(repCount(prescription.reps) * tempo)),
    [isTimed, prescription.reps, tempo],
  );

  const [setIndex, setSetIndex] = useState(0);
  const [phase, setPhase] = useState<"idle" | "work" | "rest" | "finished">("idle");
  const [left, setLeft] = useState(workSeconds);
  const [running, setRunning] = useState(false);
  const beepRef = useRef<((freq: number) => void) | null>(null);

  useEffect(() => {
    if (phase === "idle") setLeft(workSeconds);
  }, [phase, workSeconds]);

  useEffect(() => {
    beepRef.current = (freq: number) => {
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          void ctx.close();
        }, 180);
      } catch {
        /* audio is best-effort */
      }
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((prev) => {
        if (prev > 1) return prev - 1;
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || left > 0) return;
    beepRef.current?.(phase === "work" ? 660 : 880);
    if (navigator.vibrate) navigator.vibrate(120);
    if (phase === "work") {
      const isLastSet = setIndex + 1 >= prescription.sets;
      if (isLastSet) {
        setPhase("finished");
        setRunning(false);
        return;
      }
      setPhase("rest");
      setLeft(prescription.rest_seconds || 60);
      return;
    }
    if (phase === "rest") {
      setSetIndex((s) => s + 1);
      setPhase("work");
      setLeft(workSeconds);
    }
  }, [left, running, phase, setIndex, prescription.sets, prescription.rest_seconds, workSeconds]);

  function start() {
    if (phase === "idle" || phase === "finished") {
      setSetIndex(0);
      setPhase("work");
      setLeft(workSeconds);
    }
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setPhase("idle");
    setSetIndex(0);
    setLeft(workSeconds);
  }

  const totalSeconds = phase === "rest" ? prescription.rest_seconds || 60 : workSeconds;
  const pct = totalSeconds > 0 ? ((totalSeconds - left) / totalSeconds) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-background/80 backdrop-blur-sm"
      />
      <div className="animate-sheet-up relative z-10 max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border border-border bg-surface pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-surface/95 px-4 pb-3 pt-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-bold">{prescription.name}</h2>
            <p className="text-xs text-muted-foreground">
              {prescription.sets} × {prescription.reps} · {prescription.rest_seconds}s rest
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="tap flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 pt-4">
          {/* Timer */}
          <section className="rounded-3xl border border-border bg-surface-alt p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {phase === "rest"
                ? "Rest"
                : phase === "finished"
                  ? "All sets done"
                  : `Set ${Math.min(setIndex + 1, prescription.sets)} of ${prescription.sets}`}
            </p>
            <p className="mt-1 font-display text-5xl font-bold tabular-nums">{mmss(left)}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-1000 ease-linear",
                  phase === "rest" ? "bg-grade-c" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => (running ? setRunning(false) : start())}
                className="tap inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                {running ? <Pause className="size-4" /> : <Play className="size-4" />}
                {running ? "Pause" : phase === "idle" || phase === "finished" ? "Start set" : "Resume"}
              </button>
              <button
                type="button"
                aria-label="Reset timer"
                onClick={reset}
                className="tap flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground"
              >
                <RotateCcw className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex justify-center gap-1.5">
              {Array.from({ length: prescription.sets }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-colors",
                    i < setIndex || phase === "finished" ? "bg-primary" : i === setIndex ? "bg-primary/50" : "bg-border",
                  )}
                />
              ))}
            </div>
          </section>

          {/* Jiya's how-to */}
          <section className="rounded-3xl border border-border bg-surface p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> How to do it — by Jiya
            </h3>
            {isLoading ? (
              <div className="mt-4 space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-3 animate-pulse rounded-full bg-surface-alt" style={{ width: `${90 - i * 12}%` }} />
                ))}
              </div>
            ) : guide ? (
              <div className="mt-3 space-y-4 text-sm">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Works: </span>
                  {guide.target_muscles}
                </p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Set up</p>
                  <ul className="mt-1.5 space-y-1">
                    {guide.setup.map((s) => (
                      <li key={s} className="text-sm text-muted-foreground">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step by step</p>
                  <ol className="mt-1.5 space-y-2">
                    {guide.steps.map((s, i) => (
                      <li key={s} className="flex gap-2.5">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-sm">{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <p className="rounded-2xl bg-surface-alt p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Breathing: </span>
                  {guide.breathing}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Form cues</p>
                    <ul className="mt-1.5 space-y-1">
                      {guide.cues.map((c) => (
                        <li key={c} className="text-xs text-muted-foreground">
                          • {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-grade-d">Avoid</p>
                    <ul className="mt-1.5 space-y-1">
                      {guide.mistakes.map((m) => (
                        <li key={m} className="text-xs text-muted-foreground">
                          • {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Guide unavailable right now.</p>
            )}
          </section>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSwap}
              disabled={swapping}
              className="tap inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-3 text-sm font-semibold text-muted-foreground disabled:opacity-50"
            >
              {swapping ? <Loader2 className="size-4 animate-spin" /> : <Repeat2 className="size-4" />} Swap
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="tap inline-flex flex-[1.6] items-center justify-center gap-1.5 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              <CheckCircle2 className="size-4" /> Mark done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
