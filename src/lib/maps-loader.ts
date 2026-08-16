/** Loads the Google Maps JS API once, in the browser only. */
let loadPromise: Promise<typeof google.maps> | null = null;

declare global {
  interface Window {
    __initWalkMap?: () => void;
  }
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("Maps can only load in the browser"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loadPromise) return loadPromise;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as string | undefined;
  if (!key) return Promise.reject(new Error("Google Maps is not configured"));

  loadPromise = new Promise((resolve, reject) => {
    window.__initWalkMap = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&callback=__initWalkMap` +
      (channel ? `&channel=${encodeURIComponent(channel)}` : "");
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
