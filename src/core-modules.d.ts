declare module "@/core/algorithm.js" {
  import type { Poi } from "@/types/poi";

  export function calcolaDistanza(
    posUtente: { lat: number; lng: number },
    poiPosizione: { lat: number; lng: number },
  ): number;

  export function valutaTriggerAsciugatura(
    poiAsciugatura: Poi[],
    posUtente: { lat: number; lng: number } | null,
  ): Poi | null;
}

declare module "@/core/notifications.js" {
  export function valutaTuttiIPoi(
    pois: unknown[],
    posUtente: { lat: number; lng: number } | null,
    onNotificaAttrazione?: (poi: unknown, tipo?: "attrazione" | "post_pranzo" | "ultimo_giro") => void,
    onNotificaRistoro?: (poi: unknown) => void,
  ): void;
}
