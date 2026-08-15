/**
 * Lightweight in-app pedometer built on the device motion sensor.
 * Counts steps while the app is open (browsers have no background sensor access).
 */

type MotionPermissionCtor = {
  requestPermission?: () => Promise<"granted" | "denied" | "prompt">;
};

export function isPedometerSupported() {
  return typeof window !== "undefined" && typeof window.DeviceMotionEvent !== "undefined";
}

export async function requestMotionPermission(): Promise<boolean> {
  if (!isPedometerSupported()) return false;
  const ctor = window.DeviceMotionEvent as unknown as MotionPermissionCtor;
  if (typeof ctor.requestPermission !== "function") return true;
  try {
    return (await ctor.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

type Options = {
  /** Called with the number of new steps detected since the previous call. */
  onSteps: (delta: number) => void;
};

/**
 * Starts listening for steps. Returns a stop function.
 * Uses a smoothed acceleration magnitude with peak detection and a refractory
 * period so shakes and jitter don't inflate the count.
 */
export function startPedometer({ onSteps }: Options) {
  const THRESHOLD = 1.15; // m/s^2 above smoothed baseline
  const MIN_STEP_GAP = 280; // ms between steps (~215 steps/min max)

  let smoothed = 9.81;
  let armed = true;
  let lastStepAt = 0;
  let pending = 0;

  const flush = () => {
    if (pending > 0) {
      onSteps(pending);
      pending = 0;
    }
  };

  const handler = (event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity;
    if (!a) return;
    const magnitude = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
    smoothed = smoothed * 0.9 + magnitude * 0.1;
    const delta = magnitude - smoothed;
    const now = Date.now();

    if (armed && delta > THRESHOLD && now - lastStepAt > MIN_STEP_GAP) {
      armed = false;
      lastStepAt = now;
      pending += 1;
    } else if (!armed && delta < THRESHOLD * 0.4) {
      armed = true;
    }
  };

  window.addEventListener("devicemotion", handler);
  const interval = window.setInterval(flush, 1000);

  return () => {
    window.removeEventListener("devicemotion", handler);
    window.clearInterval(interval);
    flush();
  };
}

/** Rough calorie burn from steps for an average stride and body weight. */
export function caloriesFromSteps(steps: number, weightKg = 70) {
  const km = (steps * 0.75) / 1000;
  return Math.round(km * weightKg * 0.75);
}

/** Rough distance in km from steps. */
export function kmFromSteps(steps: number) {
  return (steps * 0.75) / 1000;
}
