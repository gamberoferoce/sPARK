import { calcolaDistanza } from "@/core/algorithm.js";
import { driftFloatClassName } from "@/components/motion";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Poi } from "@/types/poi";

type Props = {
  open: boolean;
  posUtente: Poi["posizione"] | null;
  destinazione: Poi | null;
  onClose: () => void;
};

export function MiniMapOverlay({ open, posUtente, destinazione, onClose }: Props) {

  if (!open) return null;

  const distanzaM =
    posUtente && destinazione
      ? calcolaDistanza(posUtente, { lat: destinazione.posizione.lat, lng: destinazione.posizione.lng })
      : null;

  // Euristica: se sei “abbastanza vicino” a una destinazione del parco, consideriamo l’utente dentro.
  // (Non abbiamo un perimetro del parco nel dataset.)
  const INSIDE_PARK_MAX_METERS = 2500;
  const dentroParco = typeof distanzaM === "number" && Number.isFinite(distanzaM) && distanzaM <= INSIDE_PARK_MAX_METERS;

  const distanzaLabel =
    typeof distanzaM === "number" && Number.isFinite(distanzaM)
      ? distanzaM < 1000
        ? `${Math.round(distanzaM)} m`
        : `${(distanzaM / 1000).toFixed(1)} km`
      : "";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="flex flex-col items-center">
        {dentroParco && destinazione ? (
          <div className="mb-3 w-[200px] text-center">
            <div className="flex items-center justify-center gap-2">
              <MapPin className="h-4 w-4 text-zinc-200" />
              <div className="truncate text-sm font-semibold text-zinc-100">{destinazione.nome}</div>
            </div>
            <div className="mt-0.5 text-xs text-zinc-400">{distanzaLabel}</div>
          </div>
        ) : (
          <div className="mb-3 flex w-[min(280px,90vw)] flex-col items-center gap-2 text-center">
            <img
              src="/feature-unavailable-fox.png"
              alt=""
              className={driftFloatClassName(
                "pointer-events-none h-[clamp(4.5rem,22vw,7rem)] w-auto max-w-[min(200px,72vw)] select-none object-contain",
              )}
              draggable={false}
            />
            <p className="text-sm leading-snug text-zinc-200">This feature is not yet available</p>
          </div>
        )}

        <div
          className="relative h-[200px] w-[200px] overflow-hidden rounded-full bg-black/20 ring-1 ring-white/10 backdrop-blur-[1px]"
          style={{
            WebkitMaskImage:
              "radial-gradient(circle at center, rgba(0,0,0,1) 68%, rgba(0,0,0,0) 100%)",
            maskImage:
              "radial-gradient(circle at center, rgba(0,0,0,1) 68%, rgba(0,0,0,0) 100%)",
          }}
        >
          <img
            src="/map-europapark.png"
            alt="Mappa"
            className="h-full w-full object-cover opacity-80"
            draggable={false}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          aria-label="Close map"
          onClick={onClose}
          className="mt-3 h-9 w-9 rounded-full bg-transparent p-0"
        >
          ×
        </Button>
      </div>
    </div>
  );
}

