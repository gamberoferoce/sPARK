import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { Poi } from "@/types/poi";

type Props = {
  open: boolean;
  attrazioni: Poi[];
  onBadgeUnlocked: (attrazioneId: string) => void;
  onSuccessDone: () => void;
  onFailExit: () => void;
  containerClassName?: string;
  reticlePlacement?: "center" | "betweenTopAndButton";
};

type UnlockUi = {
  label: string;
  colore: string;
};

export function BadgeScanner({
  open,
  attrazioni,
  onBadgeUnlocked,
  onSuccessDone,
  onFailExit,
  containerClassName,
  reticlePlacement = "center",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastHitRef = useRef<{ id: string; at: number } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [unlockUi, setUnlockUi] = useState<UnlockUi | null>(null);
  const [endingText, setEndingText] = useState<string | null>(null);
  const seenOnceRef = useRef(false);

  // markerId (1..N) -> simbolo (file svg) -> attrazione
  const markerToSimbolo = useMemo(() => {
    const out: Record<number, string> = {};
    // stable ordering
    const list = [...attrazioni].sort((a, b) => a.id.localeCompare(b.id, "it"));
    list.forEach((a, i) => {
      const simbolo = a.badge?.simbolo;
      if (simbolo) out[i + 1] = simbolo;
    });
    return out;
  }, [attrazioni]);

  const simboloToAttrazione = useMemo(() => {
    const out: Record<string, Poi> = {};
    for (const a of attrazioni) {
      if (a.badge?.simbolo) out[a.badge.simbolo] = a;
    }
    return out;
  }, [attrazioni]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUnlockUi(null);
    setEndingText(null);
    seenOnceRef.current = false;

    let cancelled = false;
    let timeoutId: number | null = null;

    const start = async () => {
      try {
        // Ensure AR.js is bundled/available (WebXR overlay compatibility)
        await import("@ar-js-org/ar.js");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) return;
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // lazy import js-aruco
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aruco = await import("js-aruco");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Detector = (aruco as any).AR?.Detector;
        if (!Detector) {
          setError("Could not initialize the ArUco detector.");
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new Detector();

        const tick = () => {
          const v = videoRef.current;
          const c = canvasRef.current;
          if (!v || !c) return;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          const w = v.videoWidth || 640;
          const h = v.videoHeight || 480;
          if (c.width !== w) c.width = w;
          if (c.height !== h) c.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const markers = detector.detect(imageData);

          if (Array.isArray(markers) && markers.length > 0) {
            // pick strongest marker (first)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const markerId = (markers[0] as any)?.id as number | undefined;
            if (typeof markerId === "number") {
              const simbolo = markerToSimbolo[markerId];
              const attr = simbolo ? simboloToAttrazione[simbolo] : null;
              if (attr && attr.badge) {
                const now = Date.now();
                const last = lastHitRef.current;
                if (!last || last.id !== attr.id || now - last.at > 2000) {
                  lastHitRef.current = { id: attr.id, at: now };
                  onBadgeUnlocked(attr.id);
                  setUnlockUi({ label: `${attr.nome} - unlocked`, colore: attr.badge.colore });
                  seenOnceRef.current = true;
                  window.setTimeout(() => {
                    setUnlockUi(null);
                    onSuccessDone();
                  }, 1200);
                }
              }
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setError("Camera permission denied or unavailable.");
      }
    };

    start();

    // Fail timeout: if nothing recognized, show message then exit to app
    timeoutId = window.setTimeout(() => {
      if (seenOnceRef.current) return;
      setEndingText("Nothing here");
      window.setTimeout(() => onFailExit(), 900);
    }, 8000);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const stream = streamRef.current;
      streamRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      lastHitRef.current = null;
    };
  }, [open, markerToSimbolo, simboloToAttrazione, onBadgeUnlocked, onFailExit, onSuccessDone]);

  if (!open) return null;

  return (
    <div className={containerClassName ?? "fixed inset-0 z-[90] bg-black/35 backdrop-blur-[1px]"}>
      <div className="absolute inset-0">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Minimal cue: reticle + close */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ top: reticlePlacement === "betweenTopAndButton" ? "38%" : "50%" }}
        >
          <div className="h-40 w-40 rounded-full ring-2 ring-white/25" />
        </div>
      </div>

      <button
        type="button"
        aria-label="Close scanner"
        onClick={() => {
          setEndingText("Nothing here");
          window.setTimeout(() => onFailExit(), 700);
        }}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-zinc-100 ring-1 ring-white/10 backdrop-blur"
      >
        <X className="h-4 w-4" />
      </button>

      {error ? (
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <div className="rounded-2xl bg-zinc-950/80 p-4 text-sm text-zinc-200 ring-1 ring-white/10 backdrop-blur">
            {error}
          </div>
        </div>
      ) : null}

      {endingText ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-2xl bg-zinc-950/80 px-5 py-3 text-sm text-zinc-200 ring-1 ring-white/10 backdrop-blur">
            {endingText}
          </div>
        </div>
      ) : null}

      {unlockUi ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div
            className="rounded-3xl bg-zinc-950/80 px-6 py-5 text-center ring-1 ring-white/10 backdrop-blur"
            style={{
              transform: "scale(1)",
              transition: "transform 300ms ease, box-shadow 300ms ease",
              boxShadow: `0 0 32px ${unlockUi.colore}55`,
            }}
          >
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl ring-1 ring-white/10" style={{ backgroundColor: unlockUi.colore + "22" }}>
              <Sparkles className="h-5 w-5" style={{ color: unlockUi.colore }} />
            </div>
            <div className="text-sm font-semibold text-zinc-100">{unlockUi.label}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

