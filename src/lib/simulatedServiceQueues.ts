import type { Poi } from "@/types/poi";

/** Se ≥ questa frazione delle attrazioni (matchate con Queue-Times) risultano chiuse, ristoro/WC/asciugatura vanno in “Closed” e non si simulano code. */
export const SERVICE_QUEUE_FREEZE_ATTR_CLOSED_RATIO = 0.9;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Ristoro / WC / asciugatura: con `freezeServiceQueues` (stagione fuori orario o ≥90% attrazioni chiuse su QT) → -1; altrimenti code simulate. */
export function applySimulatedServiceQueues(pois: Poi[], freezeServiceQueues: boolean): Poi[] {
  return pois.map((p) => {
    if (!p?.id) return p;
    if (p.categoria === "ristoro") {
      return { ...p, coda_minuti: freezeServiceQueues ? -1 : randomInt(0, 25) };
    }
    if (p.categoria === "wc" || p.categoria === "asciugatura") {
      return { ...p, coda_minuti: freezeServiceQueues ? -1 : randomInt(0, 5) };
    }
    return p;
  });
}
