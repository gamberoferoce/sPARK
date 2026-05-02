import type { Poi } from "@/types/poi";

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Ristoro / WC / asciugatura: code simulate solo se il parco non è “tutto chiuso” (Queue-Times). Altrimenti -1 come attrazioni chiuse. */
export function applySimulatedServiceQueues(pois: Poi[], parcoClosed: boolean): Poi[] {
  return pois.map((p) => {
    if (!p?.id) return p;
    if (p.categoria === "ristoro") {
      return { ...p, coda_minuti: parcoClosed ? -1 : randomInt(0, 25) };
    }
    if (p.categoria === "wc" || p.categoria === "asciugatura") {
      return { ...p, coda_minuti: parcoClosed ? -1 : randomInt(0, 5) };
    }
    return p;
  });
}
