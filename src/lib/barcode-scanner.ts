/**
 * Robust barcode scanning helper.
 *
 * Strategy:
 *  1. Request the rear camera at a high resolution with continuous autofocus.
 *  2. Prefer the native BarcodeDetector API (Android Chrome) — fast + focus aware.
 *  3. Fall back to ZXing restricted to retail 1D formats with TRY_HARDER,
 *     which avoids the noisy multi-format decoding attempts.
 */

export type ScannerHandle = {
  stop: () => void;
  hasTorch: () => boolean;
  setTorch: (on: boolean) => Promise<void>;
};

export class ScannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScannerError";
  }
}

const BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "codabar",
] as const;

type MediaTrackAdvanced = MediaTrackConstraintSet & {
  focusMode?: string;
  torch?: boolean;
  zoom?: number;
};

async function getStream(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new ScannerError(
      typeof window !== "undefined" && !window.isSecureContext
        ? "Camera needs a secure (https) connection. Open the published app link."
        : "This browser does not support camera access.",
    );
  }

  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced: [{ focusMode: "continuous" } as MediaTrackAdvanced],
      },
    },
    { video: { facingMode: { ideal: "environment" } } },
    { video: true },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      const name = (err as DOMException)?.name;
      // Permission problems will not be fixed by relaxing constraints.
      if (name === "NotAllowedError" || name === "SecurityError") break;
    }
  }

  const name = (lastError as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    throw new ScannerError("Camera permission was blocked. Allow camera access in your browser settings.");
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    throw new ScannerError("No camera found on this device.");
  }
  if (name === "NotReadableError") {
    throw new ScannerError("Camera is in use by another app. Close it and try again.");
  }
  throw new ScannerError("Could not start the camera. Enter the barcode manually.");
}

async function tuneTrack(track: MediaStreamTrack) {
  const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
    focusMode?: string[];
    zoom?: { min: number; max: number };
  };
  const advanced: MediaTrackAdvanced[] = [];
  if (caps.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" });
  // A little optical zoom makes small retail barcodes far easier to decode.
  if (caps.zoom && caps.zoom.max > caps.zoom.min) {
    advanced.push({ zoom: Math.min(caps.zoom.min + (caps.zoom.max - caps.zoom.min) * 0.3, caps.zoom.max) });
  }
  if (advanced.length) {
    try {
      await track.applyConstraints({ advanced } as MediaTrackConstraints);
    } catch {
      /* not supported — ignore */
    }
  }
}

/** Starts scanning; calls onResult once with the first decoded barcode. */
export async function startBarcodeScanner(
  video: HTMLVideoElement,
  onResult: (code: string) => void,
): Promise<ScannerHandle> {
  const stream = await getStream();
  const track = stream.getVideoTracks()[0]!;
  await tuneTrack(track);

  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  try {
    await video.play();
  } catch {
    /* autoplay may resolve later */
  }

  let stopped = false;
  let raf = 0;
  let zxingStop: (() => void) | null = null;

  const finish = (code: string) => {
    if (stopped || !code) return;
    stopped = true;
    try {
      if (raf) cancelAnimationFrame(raf);
      zxingStop?.();
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    } catch {
      /* ignore */
    }
    onResult(code);
  };

  const DetectorCtor = (globalThis as unknown as { BarcodeDetector?: any }).BarcodeDetector;
  let usedNative = false;

  if (DetectorCtor) {
    try {
      const supported: string[] = (await DetectorCtor.getSupportedFormats?.()) ?? [];
      const formats = BARCODE_FORMATS.filter((f) => !supported.length || supported.includes(f));
      const detector = new DetectorCtor(formats.length ? { formats } : undefined);
      const loop = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2) {
            const codes = await detector.detect(video);
            const value = codes?.[0]?.rawValue as string | undefined;
            if (value) return finish(value);
          }
        } catch {
          /* transient frame errors */
        }
        raf = requestAnimationFrame(() => void loop());
      };
      usedNative = true;
      void loop();
    } catch {
      usedNative = false;
    }
  }

  if (!usedNative) {
    const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);
    const hints = new Map<number, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.UPC_EAN_EXTENSION,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints as never, { delayBetweenScanAttempts: 120 });
    const controls = await reader.decodeFromStream(stream, video, (res) => {
      if (res) finish(res.getText());
    });
    zxingStop = () => controls.stop();
  }

  const stop = () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    try {
      zxingStop?.();
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  const hasTorch = () =>
    Boolean((track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch);

  const setTorch = async (on: boolean) => {
    if (!hasTorch()) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackAdvanced] } as MediaTrackConstraints);
    } catch {
      /* ignore */
    }
  };

  return { stop, hasTorch, setTorch };
}
