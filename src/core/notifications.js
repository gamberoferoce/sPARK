import {
  valutaTriggerCaffe,
  valutaTriggerGelato,
  valutaTriggerPostPranzo,
  valutaTriggerUltimoGiro,
} from "./algorithm.js";
import { ATTRAZIONI, RISTORI } from "./config.js";

/**
 * Stato in-memory per gestire le notifiche su due canali separati:
 * - attrazioni: cooldown globale + per-POI (come da regole originali)
 * - ristori: una notifica per fascia oraria al giorno (indipendente dalle attrazioni)
 */
export const stato = {
  ristori: {
    caffeNotificato: false,
    gelato: { giorno: null, notificato: false },
    ultimaNotificaManualePerPoi: {},
    postPranzo: { giorno: null, notificato: false },
    ultimoGiro: { giorno: null, notificatoPerPoi: {} },
  },
};

function todayYmd(nowMs) {
  const d = new Date(nowMs);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ensureResetGelatoGiornaliero(nowMs) {
  const today = todayYmd(nowMs);
  if (stato.ristori.gelato.giorno === today) return;
  stato.ristori.gelato.giorno = today;
  stato.ristori.gelato.notificato = false;
}

function ensureResetPostPranzoGiornaliero(nowMs) {
  const today = todayYmd(nowMs);
  if (stato.ristori.postPranzo.giorno === today) return;
  stato.ristori.postPranzo.giorno = today;
  stato.ristori.postPranzo.notificato = false;
}

function ensureResetUltimoGiroGiornaliero(nowMs) {
  const today = todayYmd(nowMs);
  if (stato.ristori.ultimoGiro.giorno === today) return;
  stato.ristori.ultimoGiro.giorno = today;
  stato.ristori.ultimoGiro.notificatoPerPoi = {};
}

function passaCooldownManuale(poiId, nowMs) {
  const last = stato.ristori.ultimaNotificaManualePerPoi[poiId];
  if (last == null) return true;
  return nowMs - last >= RISTORI.cooldown_manuale_ms;
}

export function valutaTuttiIPoi(pois, posUtente, onNotificaAttrazione, onNotificaRistoro) {
  const nowMs = Date.now();

  // Guard: se la posizione utente non è disponibile, non facciamo nulla
  if (!posUtente) return;

  const list = Array.isArray(pois) ? pois : [];
  const attrazioni = list.filter((p) => p && p.categoria === "attrazione");
  const ristori = list.filter((p) => p && p.categoria === "ristoro");

  // -----------------------------
  // NOTIFICHE MANUALI (UNIVERSALI)
  // -----------------------------
  // Qualsiasi POI: se notifica_attiva e coda sotto soglia → notifica, con cooldown 60min per POI
  {
    let best = null;
    let bestCoda = Infinity;

    for (const poi of list) {
      if (!poi || !poi.id) continue;
      if (poi.notifica_attiva !== true) continue;
      if (!passaCooldownManuale(poi.id, nowMs)) continue;

      const coda = Number(poi.coda_minuti);
      if (!Number.isFinite(coda)) continue;
      if (coda >= ATTRAZIONI.soglia_coda_assoluta) continue;

      if (coda < bestCoda) {
        best = poi;
        bestCoda = coda;
      }
    }

    if (best) {
      stato.ristori.ultimaNotificaManualePerPoi[best.id] = nowMs;
      if (best.categoria === "attrazione") {
        if (typeof onNotificaAttrazione === "function") onNotificaAttrazione(best);
      } else {
        if (typeof onNotificaRistoro === "function") onNotificaRistoro(best);
      }
    }
  }

  // --------------------------
  // CANALE RISTORI
  // --------------------------
  // SMART 1: post-pranzo (una volta per fascia al giorno)
  ensureResetPostPranzoGiornaliero(nowMs);
  if (stato.ristori.postPranzo.notificato === false) {
    const poi = valutaTriggerPostPranzo(attrazioni, posUtente);
    if (poi) {
      stato.ristori.postPranzo.notificato = true;
      if (typeof onNotificaAttrazione === "function") onNotificaAttrazione(poi, "post_pranzo");
    }
  }

  // SMART 2: ultimo giro (una volta per attrazione per giornata)
  ensureResetUltimoGiroGiornaliero(nowMs);
  const bestUltimoGiro = valutaTriggerUltimoGiro(attrazioni, posUtente);
  if (bestUltimoGiro && !stato.ristori.ultimoGiro.notificatoPerPoi[bestUltimoGiro.id]) {
    stato.ristori.ultimoGiro.notificatoPerPoi[bestUltimoGiro.id] = true;
    if (typeof onNotificaAttrazione === "function") onNotificaAttrazione(bestUltimoGiro, "ultimo_giro");
  }

  // Caso 1: trigger caffe (una volta sola)
  if (stato.ristori.caffeNotificato === false && valutaTriggerCaffe(attrazioni) === true) {
    const caffe = ristori.find(
      (p) => p && p.id && Array.isArray(p.trigger) && p.trigger.includes("caffe"),
    );
    if (caffe) {
      stato.ristori.caffeNotificato = true;
      if (typeof onNotificaRistoro === "function") onNotificaRistoro(caffe);
    }
  }

  // Caso 2: trigger gelato (una volta al giorno)
  ensureResetGelatoGiornaliero(nowMs);
  if (stato.ristori.gelato.notificato === false) {
    for (const poi of ristori) {
      if (!poi || !poi.id) continue;
      if (!(Array.isArray(poi.trigger) && poi.trigger.includes("gelato"))) continue;
      if (valutaTriggerGelato(poi, posUtente) !== true) continue;
      stato.ristori.gelato.notificato = true;
      if (typeof onNotificaRistoro === "function") onNotificaRistoro(poi);
      break;
    }
  }
}

