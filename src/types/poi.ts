export type Categoria = "attrazione" | "ristoro" | "servizi" | "wc" | "asciugatura";

export type ServizioTipo = "wc" | "asciugatura";

export interface Poi {
  id: string;
  nome: string;
  categoria: Categoria;
  posizione: { lat: number; lng: number };
  notifica_attiva: boolean;
  orario_apertura: string;
  orario_chiusura: string;
  // Solo attrazioni
  coda_minuti?: number;
  altezza_minima?: number | null;
  intensità?: "bassa" | "media" | "alta";
  acquatica?: boolean;
  raggio_metri?: number;
  badge?: {
    simbolo: string;
    nome: string;
    colore: string;
  };
  // Solo ristori
  alimenti?: string[];
  trigger?: string[];
  // Solo servizi
  servizio_tipo?: ServizioTipo;
}
