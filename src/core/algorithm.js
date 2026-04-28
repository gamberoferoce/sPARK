import { ATTRAZIONI, RISTORI, SMART_TRIGGERS } from "./config.js";

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

export function valutaNotificaAttrazione(poi) {
  return poi?.notifica_attiva === true && Number(poi?.coda_minuti) < ATTRAZIONI.soglia_coda_assoluta;
}

export function valutaTriggerCaffe(tutteLeAttrazioni) {
  if (!Array.isArray(tutteLeAttrazioni) || tutteLeAttrazioni.length === 0) return false;
  let min = Infinity;
  for (const a of tutteLeAttrazioni) {
    const c = Number(a?.coda_minuti);
    if (!Number.isFinite(c)) continue;
    if (c < min) min = c;
  }
  if (!Number.isFinite(min)) return false;
  return min > RISTORI.soglia_coda_minima_caffe;
}

export function valutaTriggerGelato(poi, posUtente) {
  const now = new Date();
  const ora = now.getHours();
  if (ora < RISTORI.fascia_gelato.inizio || ora >= RISTORI.fascia_gelato.fine) return false;
  if (!poi?.posizione || !posUtente) return false;
  const distanza = calcolaDistanza(posUtente, poi.posizione);
  return Number.isFinite(distanza) && distanza < RISTORI.distanza_gelato;
}

function oraToMinuti(oraStr) {
  if (typeof oraStr !== "string") return null;
  const m = oraStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutiAllaChiusura(poi, now = new Date()) {
  const closeMin = oraToMinuti(poi?.orario_chiusura);
  if (closeMin == null) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return closeMin - nowMin;
}

export function valutaTriggerPostPranzo(attrazioni, posUtente) {
  if (!posUtente) return null;

  const now = new Date();
  const ora = now.getHours();
  if (ora < SMART_TRIGGERS.fascia_post_pranzo.inizio || ora >= SMART_TRIGGERS.fascia_post_pranzo.fine) {
    return null;
  }

  const list = Array.isArray(attrazioni) ? attrazioni : [];
  let best = null;
  let bestD = Infinity;

  for (const poi of list) {
    if (!poi || !poi.id) continue;
    const intensita = poi?.["intensità"];
    if (intensita !== "bassa") continue;
    const coda = Number(poi.coda_minuti);
    if (!Number.isFinite(coda) || coda >= SMART_TRIGGERS.soglia_coda_post_pranzo) continue;
    if (!poi.posizione) continue;

    const d = calcolaDistanza(posUtente, poi.posizione);
    if (!Number.isFinite(d)) continue;
    if (d < bestD) {
      best = poi;
      bestD = d;
    }
  }

  return best;
}

export function valutaTriggerUltimoGiro(attrazioni, posUtente) {
  if (!posUtente) return null;

  const list = Array.isArray(attrazioni) ? attrazioni : [];
  let best = null;
  let bestD = Infinity;

  for (const poi of list) {
    if (!poi || !poi.id) continue;
    if (poi.notifica_attiva !== true) continue;

    const coda = Number(poi.coda_minuti);
    if (!Number.isFinite(coda) || coda >= SMART_TRIGGERS.soglia_coda_ultimo_giro) continue;

    const mins = minutiAllaChiusura(poi);
    if (!Number.isFinite(mins)) continue;
    if (mins < 0 || mins > SMART_TRIGGERS.minuti_pre_chiusura) continue;

    if (!poi.posizione) continue;
    const d = calcolaDistanza(posUtente, poi.posizione);
    if (!Number.isFinite(d)) continue;

    if (d < bestD) {
      best = poi;
      bestD = d;
    }
  }

  return best;
}

export function valutaTriggerAsciugatura(poiAsciugatura, posUtente) {
  if (!posUtente) return null;
  const list = Array.isArray(poiAsciugatura) ? poiAsciugatura : [];
  let best = null;
  let bestD = Infinity;
  for (const poi of list) {
    if (!poi || !poi.id || !poi.posizione) continue;
    const d = calcolaDistanza(posUtente, poi.posizione);
    if (!Number.isFinite(d)) continue;
    if (d > 300) continue;
    if (d < bestD) {
      best = poi;
      bestD = d;
    }
  }
  return best;
}

