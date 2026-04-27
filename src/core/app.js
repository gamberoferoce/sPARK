import { filtraAttrazioni, filtraRistori } from "./filters.js";
import { valutaTuttiIPoi } from "./notifications.js";

// Preferenze utente (hardcoded per ora)
const preferenze = {
  altezza_minima: null,
  dieta: null,
};

// POI validati + filtrati (mutabili: la simulazione aggiorna le code in-place)
let pois = [];

// Posizione utente aggiornata da watchPosition
let posUtente = null;

function isNumberFinite(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function isPoiValido(p) {
  // Valida i campi minimi richiesti: id, posizione.lat, posizione.lng
  if (!p || typeof p.id !== "string" || p.id.trim() === "") return false;
  if (!p.posizione) return false;
  if (!isNumberFinite(p.posizione.lat)) return false;
  if (!isNumberFinite(p.posizione.lng)) return false;
  return true;
}

async function caricaPois() {
  const res = await fetch("./poi.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossibile caricare poi.json (${res.status})`);

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  // Scarta silenziosamente POI invalidi
  return data.filter(isPoiValido);
}

function applicaFiltriPreferenze(poisValidi, pref) {
  const attrazioni = poisValidi.filter((p) => p.categoria === "attrazione");
  const ristori = poisValidi.filter((p) => p.categoria === "ristoro");
  const wc = poisValidi.filter((p) => p.categoria === "wc");

  const attrazioniFiltrate = filtraAttrazioni(attrazioni, pref);
  const ristoriFiltrati = filtraRistori(ristori, pref);

  // Ricombina: tutto ciò che è stato filtrato fuori non entra nel loop notifiche
  return [...attrazioniFiltrate, ...ristoriFiltrati, ...wc];
}

function startGeolocalizzazione() {
  if (!("geolocation" in navigator)) {
    console.error("Geolocation API non disponibile: blocco avvio app.");
    return false;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      posUtente = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
    },
    (err) => {
      console.error("Errore geolocalizzazione:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    }
  );

  return true;
}

function onNotificaAttrazione(poi) {
  console.log("[NOTIFICA][ATTRAZIONE]", poi);
}

function onNotificaRistoro(poi, fascia) {
  console.log("[NOTIFICA][RISTORO]", { fascia, poi });
}

function startLoopNotifiche() {
  setInterval(() => {
    // Non chiamare se posUtente è null
    if (!posUtente) return;

    valutaTuttiIPoi(pois, posUtente, onNotificaAttrazione, onNotificaRistoro);
  }, 60 * 1000);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startSimulazioneCode() {
  setInterval(() => {
    for (const p of pois) {
      // Salta POI invalidi/strani (extra guard)
      if (!p || !p.id) continue;

      if (p.categoria === "attrazione") {
        p.coda_minuti = randomInt(5, 80);
      } else if (p.categoria === "ristoro") {
        p.coda_minuti = randomInt(0, 25);
      }
      // wc: non aggiornare
    }

    console.log("[SIMULAZIONE] Code aggiornate");
  }, 90 * 1000);
}

async function init() {
  try {
    const poisValidi = await caricaPois();
    pois = applicaFiltriPreferenze(poisValidi, preferenze);
    console.log(`[INIT] POI validi: ${poisValidi.length}, dopo filtri: ${pois.length}`);
  } catch (e) {
    console.error("Errore caricamento POI:", e);
    return;
  }

  const okGeo = startGeolocalizzazione();
  if (!okGeo) return;

  startLoopNotifiche();
  startSimulazioneCode();
}

init();

