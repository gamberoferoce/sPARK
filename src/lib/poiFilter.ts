import type { ProfiloUtente } from "@/components/Onboarding";
import type { Poi } from "@/types/poi";

/** Same rules as `poisFiltrati` in App.tsx — single source of truth for desktop + XR. */
export function filterPoisByProfile(pois: Poi[], profilo: ProfiloUtente): Poi[] {
  const out: Poi[] = [];
  for (const p of pois) {
    if (!p || !p.id) continue;

    if (p.categoria === "servizi" || p.categoria === "wc" || p.categoria === "asciugatura") {
      out.push(p);
      continue;
    }

    if (p.categoria === "attrazione") {
      const i = p["intensità"];
      if (i !== "bassa" && i !== "media" && i !== "alta") continue;
      if (!profilo.intensita.includes(i)) continue;

      const min = p.altezza_minima;
      if (min != null && Number.isFinite(min) && profilo.altezza_cm < min) continue;

      out.push(p);
      continue;
    }

    if (p.categoria === "ristoro") {
      const alimenti = Array.isArray(p.alimenti) ? p.alimenti : [];
      const ok = profilo.diete.some((d) => alimenti.includes(d));
      if (!ok) continue;
      out.push(p);
      continue;
    }
  }
  return out;
}
