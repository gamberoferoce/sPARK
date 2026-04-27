import { calcolaPunteggioAttrazione, calcolaPunteggioRistoro } from "./algorithm.js";
import { ATTRAZIONI, FASCE_ORARIE, RISTORI } from "./config.js";

/**
 * Stato in-memory per gestire le notifiche su due canali separati:
 * - attrazioni: cooldown globale + per-POI (come da regole originali)
 * - ristori: una notifica per fascia oraria al giorno (indipendente dalle attrazioni)
 */
export const stato = {
  attrazioni: {
    ultimaNotifica: null,
    ultimaNotificaPerPoi: {},
  },
  ristori: {
    // Stringa YYYY-MM-DD dell'ultima volta che abbiamo resettato le fasce
    giorno: null,
    fasceNotificateOggi: {
      colazione: false,
      pranzo: false,
      merenda: false,
      cena: false,
    },
  },
};

// Canale attrazioni: cooldown centralizzati in config
export const COOLDOWN_GLOBALE = ATTRAZIONI.cooldown_globale_ms;
export const COOLDOWN_POI = ATTRAZIONI.cooldown_poi_ms;

/**
 * Decide se è possibile notificare ora secondo il cooldown globale.
 * @param {number} nowMs
 * @returns {boolean}
 */
function passaCooldownGlobale(nowMs) {
  // Se non abbiamo mai notificato, possiamo farlo subito
  if (stato.attrazioni.ultimaNotifica == null) return true;
  // Altrimenti verifichiamo che sia passato il tempo minimo
  return nowMs - stato.attrazioni.ultimaNotifica >= COOLDOWN_GLOBALE;
}

/**
 * Decide se è possibile notificare questo POI secondo il cooldown per-POI.
 * @param {string} poiId
 * @param {number} nowMs
 * @returns {boolean}
 */
function passaCooldownPoi(poiId, nowMs) {
  const last = stato.attrazioni.ultimaNotificaPerPoi[poiId];
  // Se questo POI non è mai stato notificato, è notificabile
  if (last == null) return true;
  // Altrimenti deve essere passato il tempo minimo
  return nowMs - last >= COOLDOWN_POI;
}

/**
 * Ritorna la fascia ristoro corrente in base all'ora locale.
 *
 * Regole:
 * - colazione: 10:00 - 11:59
 * - pranzo:    12:00 - 14:59
 * - merenda:   15:00 - 17:59
 * - cena:      18:00 - 20:59
 *
 * @returns {"colazione"|"pranzo"|"merenda"|"cena"|null}
 */
function fasciaRistoroCorrente() {
  const ora = new Date().getHours();
  if (ora >= FASCE_ORARIE.colazione.inizio && ora < FASCE_ORARIE.colazione.fine) return "colazione";
  if (ora >= FASCE_ORARIE.pranzo.inizio && ora < FASCE_ORARIE.pranzo.fine) return "pranzo";
  if (ora >= FASCE_ORARIE.merenda.inizio && ora < FASCE_ORARIE.merenda.fine) return "merenda";
  if (ora >= FASCE_ORARIE.cena.inizio && ora < FASCE_ORARIE.cena.fine) return "cena";
  return null;
}

/**
 * Reset giornaliero delle fasce notificate (ristori).
 * @param {number} nowMs
 */
function ensureResetFasceRistoro(nowMs) {
  const d = new Date(nowMs);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const today = `${yyyy}-${mm}-${dd}`;

  if (stato.ristori.giorno === today) return;

  stato.ristori.giorno = today;
  stato.ristori.fasceNotificateOggi = {
    colazione: false,
    pranzo: false,
    merenda: false,
    cena: false,
  };
}

/**
 * Valuta tutti i POI e può sparare:
 * - max 1 notifica attrazione (canale attrazioni)
 * - max 1 notifica ristoro (canale ristori, indipendente)
 *
 * Regole:
 * - Considera solo attrazioni e ristori (esclude WC).
 *
 * Canale attrazioni (invariato):
 * - cooldown globale 10min, cooldown per-POI 30min
 * - notifica solo se calcolaPunteggioAttrazione(...) > 8
 * - max 1 per chiamata, sceglie punteggio più alto
 *
 * Canale ristori (separato, nessun cooldown condiviso):
 * - notifica una sola volta per fascia al giorno (colazione/pranzo/merenda/cena)
 * - quando la fascia scatta, valuta i ristori disponibili per quella fascia
 * - sceglie il migliore per distanza + coda
 * - notifica una sola volta e marca la fascia come notificata
 *
 * @param {Array<Object>} pois
 * @param {{lat:number, lng:number}} posUtente
 * @param {(poi:Object)=>void} onNotificaAttrazione
 * @param {(poi:Object, fascia:"colazione"|"pranzo"|"merenda"|"cena")=>void} onNotificaRistoro
 * @returns {{attrazione:Object|null, ristoro:Object|null, fasciaRistoro:("colazione"|"pranzo"|"merenda"|"cena"|null)}}
 */
export function valutaTuttiIPoi(pois, posUtente, onNotificaAttrazione, onNotificaRistoro) {
  const nowMs = Date.now();

  // Guard: se la posizione utente non è disponibile, non facciamo nulla
  if (!posUtente) {
    return { attrazione: null, ristoro: null, fasciaRistoro: null };
  }

  // Separiamo attrazioni e ristori, ignorando i WC (o qualsiasi categoria non rilevante)
  const attrazioni = Array.isArray(pois)
    ? pois.filter((p) => p && p.categoria === "attrazione")
    : [];

  const candidatiAttrazioni = attrazioni;

  const candidatiRistori = Array.isArray(pois)
    ? pois.filter(
        (p) =>
          p &&
          p.categoria === "ristoro"
      )
    : [];

  // -----------------------------
  // CANALE ATTRAZIONI (invariato)
  // -----------------------------
  let attrazioneNotificata = null;

  // Cooldown globale: se non passa, non notifichiamo attrazioni (ma i ristori restano indipendenti)
  if (passaCooldownGlobale(nowMs)) {
    let miglioreAttrazione = null;
    let migliorPunteggioAttrazione = -Infinity;

    for (const poi of candidatiAttrazioni) {
      // Guard: salta silenziosamente POI senza id
      if (!poi || !poi.id) continue;

      // Cooldown per POI
      if (!passaCooldownPoi(poi.id, nowMs)) continue;

      const score = calcolaPunteggioAttrazione(poi, attrazioni, posUtente);
      if (score > ATTRAZIONI.soglia_notifica && score > migliorPunteggioAttrazione) {
        miglioreAttrazione = poi;
        migliorPunteggioAttrazione = score;
      }
    }

    if (miglioreAttrazione) {
      stato.attrazioni.ultimaNotifica = nowMs;
      stato.attrazioni.ultimaNotificaPerPoi[miglioreAttrazione.id] = nowMs;

      if (typeof onNotificaAttrazione === "function") onNotificaAttrazione(miglioreAttrazione);
      attrazioneNotificata = miglioreAttrazione;
    }
  }

  // --------------------------
  // CANALE RISTORI (separato)
  // --------------------------
  ensureResetFasceRistoro(nowMs);

  const fascia = fasciaRistoroCorrente();
  let ristoroNotificato = null;

  if (fascia && stato.ristori.fasceNotificateOggi[fascia] === false) {
    // Filtra i ristori che dichiarano di essere disponibili in questa fascia.
    // Nota: per colazione, se il dataset non contiene "colazione", semplicemente non notificherà.
    const ristoriInFascia = candidatiRistori.filter(
      (p) =>
        p &&
        p.id &&
        Array.isArray(p.fascia_oraria) &&
        p.fascia_oraria.includes(fascia)
    );

    // Scegliamo il ristoro col punteggio più alto.
    // Non "bruciamo" la fascia finché nessun ristoro supera > 7:
    // riproveremo al ciclo successivo finché la fascia non scade.
    let miglioreRistoro = null;
    let migliorScore = -Infinity;

    for (const poi of ristoriInFascia) {
      const score = calcolaPunteggioRistoro(poi, posUtente);
      if (score > RISTORI.soglia_notifica && score > migliorScore) {
        migliorScore = score;
        miglioreRistoro = poi;
      }
    }

    if (miglioreRistoro) {
      stato.ristori.fasceNotificateOggi[fascia] = true;

      if (typeof onNotificaRistoro === "function") onNotificaRistoro(miglioreRistoro, fascia);
      ristoroNotificato = miglioreRistoro;
    }
  }

  return {
    attrazione: attrazioneNotificata,
    ristoro: ristoroNotificato,
    fasciaRistoro: fascia,
  };
}

