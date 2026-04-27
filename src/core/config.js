// Config centralizzata: SOLO costanti e regole di business (nessuna logica)

// Fasce orarie ristori (ore in formato 24h; "fine" è esclusivo)
export const FASCE_ORARIE = {
  colazione: { inizio: 10, fine: 12 },
  pranzo: { inizio: 12, fine: 15 },
  merenda: { inizio: 15, fine: 18 },
  cena: { inizio: 18, fine: 21 },
};

// Soglie attrazioni
export const ATTRAZIONI = {
  soglia_notifica: 8,
  soglia_coda_relativa: 0.6,
  distanza_max: 500,
  peso_coda: 0.7,
  peso_distanza: 0.3,
  cooldown_globale_ms: 10 * 60 * 1000,
  cooldown_poi_ms: 30 * 60 * 1000,
};

// Soglie ristori
export const RISTORI = {
  soglia_notifica: 7,
  coda_max: 20,
  distanza_max: 500,
  peso_coda: 0.7,
  peso_distanza: 0.3,
};

