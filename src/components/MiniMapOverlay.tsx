import { calcolaDistanza } from "@/core/algorithm.js";
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
          <div className="mb-3 w-[200px] text-center text-sm text-zinc-200">
            Navigazione disponibile solo all&apos;interno del parco.
          </div>
        )}

        <div className="relative h-[200px] w-[200px] overflow-hidden rounded-full bg-zinc-950 ring-1 ring-white/10">
          <img
            src="/map-placeholder.png"
            alt="Mappa"
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          aria-label="Chiudi mappa"
          onClick={onClose}
          className="mt-3 h-9 w-9 rounded-full bg-transparent p-0"
        >
          ×
        </Button>
      </div>
    </div>
  );
}

