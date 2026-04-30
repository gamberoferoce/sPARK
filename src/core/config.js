export const ATTRAZIONI = {
  soglia_coda_assoluta: 10,
  cooldown_globale_ms: 10 * 60 * 1000,
  cooldown_poi_ms: 90 * 60 * 1000,
};

export const PARCO = {
  nome: "Europa Park",
  queue_times_park_id: 51,
  stagione: { inizio: "2025-03-29", fine: "2026-01-06" },
  orario_apertura: "09:00",
  orario_chiusura_default: "18:00",
};

export const RISTORI = {
  soglia_coda_minima_caffe: 10,
  fascia_merenda: { inizio: 15, fine: 18 },
  distanza_merenda: 150,
  cooldown_manuale_ms: 60 * 60 * 1000,
};

export const SMART_TRIGGERS = {
  fascia_post_pranzo: { inizio: 14, fine: 16 },
  soglia_coda_post_pranzo: 15,
  soglia_coda_ultimo_giro: 10,
  minuti_pre_chiusura: 30,
};

