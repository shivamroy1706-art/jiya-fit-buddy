/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Square, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/app-data";
import { loadGoogleMaps } from "@/lib/maps-loader";

type Point = { lat: number; lng: number };

type Props = { userId: string };

function distanceM(a: Point, b: Point) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function WalkMap({ userId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const pathRef = useRef<Point[]>([]);
  const watchRef = useRef<number | null>(null);
  const routeIdRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);
  const [meters, setMeters] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: 20.5937, lng: 78.9629 },
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        lineRef.current = new maps.Polyline({
          path: [],
          strokeColor: "#AEEA00",
          strokeOpacity: 0.95,
          strokeWeight: 5,
          map: mapRef.current,
        });
        markerRef.current = new maps.Marker({ map: mapRef.current });
        setReady(true);

        // Centre on the walker's current spot right away.
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            mapRef.current?.setCenter(p);
            markerRef.current?.setPosition(p);
          },
          () => undefined,
          { enableHighAccuracy: true },
        );
      })
      .catch((e: Error) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  async function saveRoute(done: boolean) {
    const path = pathRef.current;
    if (path.length < 2) return;
    const payload = {
      user_id: userId,
      date: todayISO(),
      path: path as unknown as never,
      distance_m: Math.round(meters),
      ended_at: done ? new Date().toISOString() : null,
    };

    if (routeIdRef.current) {
      await supabase.from("walk_routes").update(payload).eq("id", routeIdRef.current);
    } else {
      const { data } = await supabase.from("walk_routes").insert(payload).select("id").maybeSingle();
      if (data?.id) routeIdRef.current = data.id;
    }
  }

  function stop() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setWalking(false);
    void saveRoute(true);
  }

  function start() {
    if (!navigator.geolocation) {
      setError("Location isn't available on this device.");
      return;
    }
    setError(null);
    pathRef.current = [];
    routeIdRef.current = null;
    setMeters(0);
    lineRef.current?.setPath([]);

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const last = pathRef.current[pathRef.current.length - 1];
        // Ignore GPS jitter under 5 m so the trail stays clean.
        if (last && distanceM(last, point) < 5) return;

        pathRef.current = [...pathRef.current, point];
        if (last) setMeters((m) => m + distanceM(last, point));
        lineRef.current?.setPath(pathRef.current);
        markerRef.current?.setPosition(point);
        mapRef.current?.panTo(point);
        if (pathRef.current.length % 10 === 0) void saveRoute(false);
      },
      (err) => setError(err.code === err.PERMISSION_DENIED ? "Location access was blocked." : "Couldn't get your location."),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    setWalking(true);
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="relative h-56 overflow-hidden rounded-2xl border border-border bg-surface-alt">
        <div ref={containerRef} className="size-full" />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[11px] text-muted-foreground">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="size-3.5 text-primary" />
          {walking ? `Recording · ${(meters / 1000).toFixed(2)} km walked` : "Your route draws live as you walk"}
        </p>
        <button
          type="button"
          onClick={() => (walking ? stop() : start())}
          disabled={!ready}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-[11px] font-semibold text-primary disabled:opacity-50"
        >
          {walking ? <Square className="size-3" /> : <Play className="size-3" />}
          {walking ? "Finish walk" : "Record walk"}
        </button>
      </div>
    </div>
  );
}
