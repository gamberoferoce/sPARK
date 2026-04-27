import { useEffect, useMemo, useRef, useState } from "react";
import { POIList, type Poi, type Posizione } from "@/components/POIList";
import { Onboarding, type ProfiloUtente } from "@/components/Onboarding";
import { NotificationPopup } from "@/components/NotificationPopup";
import { calcolaDistanza } from "@/core/algorithm.js";

function App() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [profilo, setProfilo] = useState<ProfiloUtente | null>(null);
  const [bellById, setBellById] = useState<Record<string, boolean>>({});
  const notifiedOnceRef = useRef<Set<string>>(new Set());
  const [debugPopup, setDebugPopup] = useState<null | "attrazione" | "caffe">(null);

  const posUtente: Posizione = useMemo(
    () => ({ lat: 45.4631, lng: 9.1894 }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/poi.json")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const loaded = Array.isArray(data) ? (data as Poi[]) : [];
        setPois(loaded);
        const initial: Record<string, boolean> = {};
        for (const p of loaded) {
          if (p && typeof p.id === "string") initial[p.id] = p.notifica_attiva === true;
        }
        setBellById(initial);
      })
      .catch(() => {
        if (cancelled) return;
        setPois([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const poisFiltrati: Poi[] = useMemo(() => {
    if (!profilo) return [];
    const out: Poi[] = [];
    for (const p of pois) {
      if (!p || !p.id) continue;
      if (p.categoria === "wc") {
        out.push(p);
        continue;
      }

      if (p.categoria === "attrazione") {
        const adr = p.adrenalina;
        if (adr && !profilo.adrenalina.includes(adr as ProfiloUtente["adrenalina"][number])) continue;

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
  }, [pois, profilo]);

  useEffect(() => {
    if (!profilo) return;
    for (const p of poisFiltrati) {
      if (!p || !p.id) continue;
      const active = bellById[p.id] === true;
      if (!active) continue;

      const coda = Number(p.coda_minuti);
      if (!Number.isFinite(coda)) continue;
      if (coda >= 15) continue;

      if (p.categoria === "ristoro") {
        const trigger = p.trigger;
        if (trigger === "pranzo" || trigger === "cena") continue;
      }

      if (notifiedOnceRef.current.has(p.id)) continue;
      notifiedOnceRef.current.add(p.id);

      console.log("[NOTIFICA][UI]", p);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(200);
      }
    }
  }, [poisFiltrati, bellById, profilo]);

  const poiDebugAttrazione = useMemo(() => {
    const fromFiltered = poisFiltrati.find((p) => p.categoria === "attrazione");
    if (fromFiltered) return fromFiltered;
    return pois.find((p) => p.categoria === "attrazione") ?? null;
  }, [poisFiltrati, pois]);

  const poiDebugCaffe = useMemo(() => {
    const pick = (list: Poi[]) =>
      list.find((p) => p.categoria === "ristoro" && p.trigger === "caffe") ?? null;
    return pick(poisFiltrati) ?? pick(pois);
  }, [poisFiltrati, pois]);

  const fallbackPoiAttrazione: Poi = useMemo(
    () => ({
      id: "__debug_attrazione__",
      nome: "Demo attrazione",
      categoria: "attrazione",
      posizione: posUtente,
      coda_minuti: 12,
    }),
    [posUtente],
  );

  const fallbackPoiCaffe: Poi = useMemo(
    () => ({
      id: "__debug_caffe__",
      nome: "Demo bar (caffè)",
      categoria: "ristoro",
      posizione: posUtente,
      coda_minuti: 5,
      trigger: "caffe",
      alimenti: ["normale"],
    }),
    [posUtente],
  );

  if (!profilo) {
    return <Onboarding onComplete={setProfilo} />;
  }

  return (
    <main className="relative mx-auto w-full max-w-lg overflow-x-visible bg-[#000000] px-4 py-4">
      <POIList
        pois={poisFiltrati}
        posUtente={posUtente}
        bellById={bellById}
        onToggleBell={(id) => setBellById((prev) => ({ ...prev, [id]: !(prev[id] === true) }))}
        calcolaDistanzaM={(poiPos) => calcolaDistanza(posUtente, poiPos)}
      />

      <div className="fixed bottom-3 left-3 z-40 flex flex-col gap-2">
        <button
          type="button"
          className="rounded-full border border-white/20 bg-zinc-900/90 px-3 py-1.5 text-left text-[11px] font-semibold text-zinc-200 shadow-lg backdrop-blur"
          onClick={() => setDebugPopup("attrazione")}
        >
          DBG popup attrazione
        </button>
        <button
          type="button"
          className="rounded-full border border-white/20 bg-zinc-900/90 px-3 py-1.5 text-left text-[11px] font-semibold text-zinc-200 shadow-lg backdrop-blur"
          onClick={() => setDebugPopup("caffe")}
        >
          DBG popup caffè
        </button>
      </div>

      <NotificationPopup
        open={debugPopup === "attrazione"}
        poi={poiDebugAttrazione ?? fallbackPoiAttrazione}
        motivo="Simulazione: coda favorevole — momento buono per entrare in attrazione."
        onClose={() => setDebugPopup(null)}
        onNaviga={(p) => {
          console.log("[DEBUG][naviga attrazione]", p);
          setDebugPopup(null);
        }}
      />
      <NotificationPopup
        open={debugPopup === "caffe"}
        variant="caffe"
        poi={poiDebugCaffe ?? fallbackPoiCaffe}
        motivo="Simulazione trigger caffè: pause consigliata vicino a te."
        onClose={() => setDebugPopup(null)}
        onNaviga={(p) => {
          console.log("[DEBUG][naviga caffe]", p);
          setDebugPopup(null);
        }}
      />
    </main>
  );
}

export default App;
