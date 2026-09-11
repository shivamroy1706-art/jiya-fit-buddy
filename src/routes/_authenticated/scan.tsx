import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { GRADE_CLASS, GRADE_MEANING, computeGrade, normalizeGrade, type Grade } from "@/lib/nutri-score";


export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Scan Food — AI Fitness Trainer" },
      {
        name: "description",
        content: "Scan any food barcode with your camera for calories, macros, additives and a health grade.",
      },
      { property: "og:title", content: "Scan Food Barcodes" },
      { property: "og:description", content: "Instant nutrition breakdown and health grade for packaged food." },
    ],
  }),
  component: ScanPage,
});

type ScanResult = {
  food_name: string;
  brand: string | null;
  grade: Grade | null;
  calories: number | null;
  serving_size: string | null;
  ingredients: string | null;
  image_url: string | null;
  macros: { protein: number | null; carbs: number | null; fat: number | null; sugars: number | null };
  allergens: string[];
};

function ScanPage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<ScannerHandle | null>(null);
  const [scanning, setScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState("");

  const { data: history, refetch } = useQuery({
    queryKey: ["scans", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("nutrition_scans")
        .select("id, food_name, brand, grade, calories, scanned_at")
        .eq("user_id", user!.id)
        .order("scanned_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => () => handleRef.current?.stop(), []);

  async function startScan() {
    setResult(null);
    setScanning(true);
    setTorchOn(false);
    try {
      const video = videoRef.current;
      if (!video) throw new ScannerError("Camera view not ready. Try again.");
      const handle = await startBarcodeScanner(video, (code) => {
        handleRef.current = null;
        setScanning(false);
        setTorchAvailable(false);
        setTorchOn(false);
        if (navigator.vibrate) navigator.vibrate(60);
        void lookup(code);
      });
      handleRef.current = handle;
      setTorchAvailable(handle.hasTorch());
    } catch (err) {
      setScanning(false);
      setTorchAvailable(false);
      toast.error(
        err instanceof ScannerError ? err.message : "Camera unavailable — enter the barcode manually.",
      );
    }
  }

  function stopScan() {
    handleRef.current?.stop();
    handleRef.current = null;
    setScanning(false);
    setTorchAvailable(false);
    setTorchOn(false);
  }

  async function toggleTorch() {
    const next = !torchOn;
    await handleRef.current?.setTorch(next);
    setTorchOn(next);
  }

  async function lookup(barcode: string) {
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
      const json = (await res.json()) as {
        status?: number;
        product?: Record<string, unknown>;
      };
      if (json.status !== 1 || !json.product) {
        toast.error("Product not found in the food database.");
        return;
      }
      const p = json.product;
      const n = (p["nutriments"] ?? {}) as Record<string, number | undefined>;
      const grade =
        normalizeGrade(p["nutriscore_grade"] as string) ??
        computeGrade({
          energyKcal: n["energy-kcal_100g"] ?? null,
          sugars: n["sugars_100g"] ?? null,
          saturatedFat: n["saturated-fat_100g"] ?? null,
          salt: n["salt_100g"] ?? null,
          sodium: n["sodium_100g"] ?? null,
          fiber: n["fiber_100g"] ?? null,
          protein: n["proteins_100g"] ?? null,
        });
      const parsed: ScanResult = {
        food_name: (p["product_name"] as string) || "Unknown food",
        brand: (p["brands"] as string) ?? null,
        grade,
        calories: n["energy-kcal_100g"] != null ? Math.round(n["energy-kcal_100g"]) : null,
        serving_size: (p["serving_size"] as string) ?? null,
        ingredients: (p["ingredients_text"] as string) ?? null,
        image_url: (p["image_url"] as string) ?? null,
        macros: {
          protein: n["proteins_100g"] ?? null,
          carbs: n["carbohydrates_100g"] ?? null,
          fat: n["fat_100g"] ?? null,
          sugars: n["sugars_100g"] ?? null,
        },
        allergens: ((p["allergens_tags"] as string[]) ?? []).map((a) => a.replace(/^en:/, "")),
      };
      setResult(parsed);


      await supabase.from("nutrition_scans").insert({
        user_id: user.id,
        barcode,
        source: "openfoodfacts",
        food_name: parsed.food_name,
        brand: parsed.brand,
        grade: parsed.grade,
        calories: parsed.calories,
        serving_size: parsed.serving_size,
        ingredients: parsed.ingredients,
        image_url: parsed.image_url,
        macros: parsed.macros,
        nutrients_per_100g: n,
        allergens: parsed.allergens,
      });
      void refetch();
    } catch {
      toast.error("Lookup failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell bg-background pb-28">
      <AppHeader title="Scan" />
      <div className="space-y-4 px-4">
        <section className="overflow-hidden rounded-3xl border border-border bg-surface">
          <div className="relative aspect-[4/3] bg-black">
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <Camera className="size-8 text-primary" />
                <p className="px-6 text-xs text-muted-foreground">
                  Point your camera at a barcode to get a full nutrition breakdown.
                </p>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-10 inset-y-16 rounded-2xl border-2 border-primary/70" />
          </div>
          <div className="flex gap-2 p-3">
            <button
              type="button"
              onClick={() => (scanning ? stopScan() : void startScan())}
              className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {scanning ? "Stop" : "Start camera"}
            </button>
          </div>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) void lookup(manual.trim());
          }}
          className="flex gap-2"
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            inputMode="numeric"
            placeholder="Enter barcode manually"
            className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button type="submit" className="rounded-full border border-primary/40 px-4 text-sm font-semibold text-primary">
            Look up
          </button>
        </form>

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> Fetching nutrition data…
          </div>
        )}

        {result && (
          <section className="rounded-3xl border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <span
                className={`flex size-11 items-center justify-center rounded-2xl font-display text-lg font-bold ${
                  result.grade ? GRADE_CLASS[result.grade] : "bg-surface-alt text-muted-foreground"
                }`}
              >
                {result.grade ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold">{result.food_name}</p>
                <p className="text-xs text-muted-foreground">{result.brand ?? "Unknown brand"}</p>
                <p className="mt-0.5 text-[11px] font-semibold">
                  {result.grade ? GRADE_MEANING[result.grade] : "Not enough data to score"}
                </p>
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => setResult(null)}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { l: "kcal", v: result.calories },
                { l: "Protein", v: result.macros.protein },
                { l: "Carbs", v: result.macros.carbs },
                { l: "Fat", v: result.macros.fat },
              ].map((m) => (
                <div key={m.l} className="rounded-2xl bg-surface-alt p-2">
                  <p className="font-display text-base font-bold text-primary">{m.v ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{m.l}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Per 100 g · {result.serving_size ?? "serving n/a"}</p>
            {result.allergens.length > 0 && (
              <p className="mt-2 text-xs text-destructive">Allergens: {result.allergens.join(", ")}</p>
            )}
            {result.ingredients && (
              <p className="mt-2 line-clamp-4 text-xs text-muted-foreground">{result.ingredients}</p>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold">Scan history</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">Your 5 most recent scans.</p>
          {(history ?? []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              No scans yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {history!.map((s) => {
                const g = normalizeGrade(s.grade);
                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                    <span
                      className={`flex size-9 items-center justify-center rounded-xl font-display font-bold ${
                        g ? GRADE_CLASS[g] : "bg-surface-alt text-muted-foreground"
                      }`}
                    >
                      {g ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.food_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.brand ?? "—"} · {s.calories ?? "—"} kcal{g ? ` · ${GRADE_MEANING[g]}` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </div>
      <BottomNav />
    </main>
  );
}
