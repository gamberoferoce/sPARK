declare module "@/core/config.js" {
  export const ATTRAZIONI: {
    soglia_coda_assoluta: number;
    cooldown_globale_ms: number;
    cooldown_poi_ms: number;
  };

  export const PARCO: {
    nome: string;
    queue_times_park_id: number;
    stagione: { inizio: string; fine: string };
    orario_apertura: string;
    orario_chiusura_default: string;
  };

  export const RISTORI: {
    soglia_coda_minima_caffe: number;
    fascia_merenda: { inizio: number; fine: number };
    distanza_merenda: number;
    cooldown_manuale_ms: number;
  };

  export const SMART_TRIGGERS: {
    fascia_post_pranzo: { inizio: number; fine: number };
    soglia_coda_post_pranzo: number;
    soglia_coda_ultimo_giro: number;
    minuti_pre_chiusura: number;
  };
}

