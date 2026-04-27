declare module "@/core/algorithm.js" {
  export function calcolaDistanza(
    posUtente: { lat: number; lng: number },
    poiPosizione: { lat: number; lng: number },
  ): number;
}
