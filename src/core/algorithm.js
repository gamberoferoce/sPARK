import { ATTRAZIONI, RISTORI } from "./config.js";

/**
 * Calcola la distanza tra due coordinate GPS usando la formula di Haversine.
 * @param {{lat:number, lng:number}} posUtente - posizione corrente dell’utente
 * @param {{lat:number, lng:number}} poiPosizione - posizione del POI
 * @returns {number} distanza in metri
 */
export function calcolaDistanza(posUtente, poiPosizione) {
  // Raggio medio della Terra in metri
  const R = 6371000;

  // Conversione gradi → radianti (necessaria per la trigonometria)
  const toRad = (deg) => (deg * Math.PI) / 180;

  const lat1 = toRad(posUtente.lat);
  const lon1 = toRad(posUtente.lng);
  const lat2 = toRad(poiPosizione.lat);
  const lon2 = toRad(poiPosizione.lng);

  // Delta tra coordinate
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  // Formula di Haversine
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calcola un punteggio (0-10) per notificare una attrazione.
 *
 * Regole:
 * - Calcola la media della coda di tutte le attrazioni.
 * - Se la coda del POI è > 60% della media, restituisce 0 (non notificabile).
 * - Altrimenti:
 *    - coda pesa 70%
 *    - distanza pesa 30%
 * - Distanza massima considerata: 500m (oltre: punteggio distanza = 0)
 *
 * @param {Object} poi
 * @param {Array<Object>} tutteLeAttrazioni
 * @param {{lat:number, lng:number}} posUtente
 * @returns {number} punteggio numerico 0-10
 */
export function calcolaPunteggioAttrazione(poi, tutteLeAttrazioni, posUtente) {
  // Se non ho attrazioni su cui calcolare la media, non posso valutare in modo sensato
  if (!Array.isArray(tutteLeAttrazioni) || tutteLeAttrazioni.length === 0) return 0;

  // Media coda (in minuti) su tutte le attrazioni
  const sommaCode = tutteLeAttrazioni.reduce((acc, a) => acc + (Number(a.coda_minuti) || 0), 0);
  const mediaCoda = sommaCode / tutteLeAttrazioni.length;

  // Se la coda del POI è troppo alta rispetto alla media, non notifichiamo
  // (condizione: maggiore del 60% della media → 0)
  if ((Number(poi.coda_minuti) || 0) > ATTRAZIONI.soglia_coda_relativa * mediaCoda) return 0;

  // Distanza in metri tra utente e attrazione
  const distanza = calcolaDistanza(posUtente, poi.posizione);

  // Normalizzazione distanza: 0..1 dove 0m => 1, 500m => 0, oltre 500m => 0
  const distanzaMax = ATTRAZIONI.distanza_max;
  const distanzaNorm = Math.max(0, 1 - Math.min(distanza, distanzaMax) / distanzaMax);

  // Normalizzazione coda: vogliamo premiare code più basse.
  // Usiamo una scala relativa alla media:
  // - coda = 0  => codaNorm = 1
  // - coda = media => codaNorm ~ 0
  // - coda > media => codaNorm = 0
  // (questa scelta mantiene un range stabile senza dipendere da un "massimo" globale)
  const coda = Number(poi.coda_minuti) || 0;
  const codaNorm = mediaCoda > 0 ? Math.max(0, 1 - coda / mediaCoda) : 0;

  // Combinazione pesata e conversione in scala 0-10
  const pesoCoda = ATTRAZIONI.peso_coda;
  const pesoDistanza = ATTRAZIONI.peso_distanza;
  const score01 = pesoCoda * codaNorm + pesoDistanza * distanzaNorm;
  const score010 = score01 * 10;

  // Arrotondamento “soft” a 2 decimali per stabilità (senza perdere granularità)
  return Math.round(score010 * 100) / 100;
}

/**
 * Calcola un punteggio (0-10) per confrontare ristori tra loro.
 *
 * Regole:
 * - Coda pesa 70%:
 *    - normalizzata 0-1 dove 0 min = 1, 20 min = 0, oltre 20 = 0
 * - Distanza pesa 30%:
 *    - normalizzata 0-1 dove 0m = 1, 500m = 0, oltre 500 = 0
 * - Restituisce punteggio 0-10 arrotondato a 2 decimali
 *
 * @param {Object} poi
 * @param {{lat:number, lng:number}} posUtente
 * @returns {number}
 */
export function calcolaPunteggioRistoro(poi, posUtente) {
  // Distanza in metri tra utente e ristoro
  const distanza = calcolaDistanza(posUtente, poi.posizione);

  // Normalizzazione distanza: 0..1 dove 0m => 1, 500m => 0, oltre 500m => 0
  const distanzaMax = RISTORI.distanza_max;
  const distanzaNorm = Math.max(0, 1 - Math.min(distanza, distanzaMax) / distanzaMax);

  // Normalizzazione coda: 0..1 dove 0min => 1, 20min => 0, oltre 20 => 0
  const coda = Number(poi.coda_minuti) || 0;
  const codaMax = RISTORI.coda_max;
  const codaNorm = Math.max(0, 1 - Math.min(coda, codaMax) / codaMax);

  // Combinazione pesata e conversione in scala 0-10
  const pesoCoda = RISTORI.peso_coda;
  const pesoDistanza = RISTORI.peso_distanza;
  const score01 = pesoCoda * codaNorm + pesoDistanza * distanzaNorm;
  const score010 = score01 * 10;

  return Math.round(score010 * 100) / 100;
}

