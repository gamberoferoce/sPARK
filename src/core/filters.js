/**
 * Filtra le attrazioni in base alle preferenze utente.
 *
 * Regola:
 * - Rimuove le attrazioni dove altezza_minima esiste (non null) ed è > preferenze.altezza_minima
 * - Se preferenze.altezza_minima è null o non definito, non filtra nulla
 *
 * @param {Array<Object>} attrazioni
 * @param {{altezza_minima?: number|null}} preferenze
 * @returns {Array<Object>} array filtrato
 */
export function filtraAttrazioni(attrazioni, preferenze) {
  // Se non ho un array valido, restituisco un array vuoto (evita errori a valle)
  if (!Array.isArray(attrazioni)) return [];

  // Se l'utente non ha specificato altezza_minima, non applichiamo filtri
  const altezzaUtente = preferenze?.altezza_minima;
  if (altezzaUtente == null) return attrazioni;

  // Manteniamo:
  // - attrazioni senza requisito (altezza_minima null/undefined)
  // - attrazioni con requisito <= altezzaUtente
  return attrazioni.filter((a) => {
    const req = a?.altezza_minima;
    if (req == null) return true;
    return Number(req) <= Number(altezzaUtente);
  });
}

/**
 * Filtra i ristori in base alle preferenze alimentari utente.
 *
 * Regola:
 * - Rimuove i ristori dove alimenti NON include preferenze.dieta
 * - Se preferenze.dieta è null, 'normale', o non definito, non filtra nulla
 *
 * @param {Array<Object>} ristori
 * @param {{dieta?: string|null}} preferenze
 * @returns {Array<Object>} array filtrato
 */
export function filtraRistori(ristori, preferenze) {
  // Se non ho un array valido, restituisco un array vuoto
  if (!Array.isArray(ristori)) return [];

  // Se l'utente non ha specificato una dieta (o è 'normale'), non applichiamo filtri
  const dieta = preferenze?.dieta;
  if (dieta == null || dieta === "normale") return ristori;

  // Manteniamo solo i ristori che dichiarano esplicitamente la dieta richiesta
  return ristori.filter((r) => Array.isArray(r?.alimenti) && r.alimenti.includes(dieta));
}

