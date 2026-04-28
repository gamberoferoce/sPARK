import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { POIList } from "@/components/POIList";
import { Onboarding, type ProfiloUtente } from "@/components/Onboarding";
import { NotificationPopup } from "@/components/NotificationPopup";
import { calcolaDistanza, valutaTriggerAsciugatura } from "@/core/algorithm.js";
import { valutaTuttiIPoi } from "@/core/notifications.js";
import type { Poi } from "@/types/poi";

function App() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [profilo, setProfilo] = useState<ProfiloUtente | null>(null);
  const [bellById, setBellById] = useState<Record<string, boolean>>({});
  const [notificaAttiva, setNotificaAttiva] = useState<{
    poi: Poi;
    tipo: "attrazione" | "ristoro";
    tipoAttrazione?: "attrazione" | "post_pranzo" | "ultimo_giro";
  } | null>(null);
  const [debugPopup, setDebugPopup] = useState<null | "attrazione" | "caffe">(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [poiPanelOpen, setPoiPanelOpen] = useState(false);

  const posFallback: Poi["posizione"] = useMemo(
    () => ({ lat: 45.4631, lng: 9.1894 }),
    [],
  );
  const [posUtente, setPosUtente] = useState<Poi["posizione"] | null>(null);

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

  // Ottiene e aggiorna posUtente via geolocalizzazione
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosUtente({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // Ignora errori: l'app resta usabile, ma le notifiche non partono senza posUtente.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const poisFiltrati: Poi[] = useMemo(() => {
    if (!profilo) return [];
    const out: Poi[] = [];
    for (const p of pois) {
      if (!p || !p.id) continue;
      if (p.categoria === "servizi") {
        out.push(p);
        continue;
      }

      if (p.categoria === "attrazione") {
        const i = (p as Poi)["intensità"];
        // Mostra solo attrazioni con intensità coerente con l'onboarding
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
  }, [pois, profilo]);

  // Simula code dinamiche: ogni 90 secondi aggiorna coda_minuti dei POI nello stato React
  useEffect(() => {
    function randomInt(min: number, max: number) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    const id = window.setInterval(() => {
      setPois((prev) =>
        prev.map((p) => {
          if (!p || !p.id) return p;
          if (p.categoria === "attrazione") return { ...p, coda_minuti: randomInt(5, 80) };
          if (p.categoria === "ristoro") return { ...p, coda_minuti: randomInt(0, 25) };
          return p; // wc invariati
        }),
      );
    }, 90 * 1000);

    return () => window.clearInterval(id);
  }, []);

  // Notifiche: ogni 60 secondi chiama valutaTuttiIPoi (solo se posUtente è disponibile)
  const posRef = useRef<Poi["posizione"] | null>(null);
  const poisFiltratiRef = useRef<Poi[]>([]);

  useEffect(() => {
    posRef.current = posUtente;
  }, [posUtente]);

  useEffect(() => {
    poisFiltratiRef.current = poisFiltrati;
  }, [poisFiltrati]);

  const onNotificaAttrazione = useCallback(
    (poi: unknown, tipo?: "attrazione" | "post_pranzo" | "ultimo_giro") => {
      console.log("[NOTIFICA][ATTRAZIONE]", poi);
      // Se arriva una notifica, chiudi il panel POI per non coprire il popup.
      setPoiPanelOpen(false);
      if (poi && typeof poi === "object") {
        setNotificaAttiva({ poi: poi as Poi, tipo: "attrazione", tipoAttrazione: tipo ?? "attrazione" });
      }
      navigator.vibrate?.(200);
    },
    [],
  );

  const onNotificaRistoro = useCallback((poi: unknown) => {
    console.log("[NOTIFICA][RISTORO]", poi);
    // Se arriva una notifica, chiudi il panel POI per non coprire il popup.
    setPoiPanelOpen(false);
    if (poi && typeof poi === "object") {
      setNotificaAttiva({ poi: poi as Poi, tipo: "ristoro" });
    }
    navigator.vibrate?.(200);
  }, []);

  // Dwell tracker asciugatura: se resti >3 minuti in un'attrazione acquatica, suggerisci asciugatura vicina (entro 300m)
  const dwellRef = useRef<{ attrId: string; startedAt: number } | null>(null);
  const asciugNotifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pos = posUtente;
    if (!pos) return;

    const attrAcquatiche = pois.filter((p) => p?.categoria === "attrazione" && p.acquatica === true);
    const asciugature = pois.filter((p) => p?.categoria === "servizi" && p.servizio_tipo === "asciugatura");

    let inside: Poi | null = null;
    for (const a of attrAcquatiche) {
      const r = Number(a.raggio_metri);
      if (!Number.isFinite(r) || r <= 0) continue;
      const d = calcolaDistanza(pos, a.posizione);
      if (Number.isFinite(d) && d <= r) {
        inside = a;
        break;
      }
    }

    if (!inside) {
      dwellRef.current = null;
      return;
    }

    if (!dwellRef.current || dwellRef.current.attrId !== inside.id) {
      dwellRef.current = { attrId: inside.id, startedAt: Date.now() };
      return;
    }

    const elapsed = Date.now() - dwellRef.current.startedAt;
    if (elapsed < 3 * 60 * 1000) return;
    if (asciugNotifiedRef.current.has(inside.id)) return;

    const best = valutaTriggerAsciugatura(asciugature, pos) as Poi | null;
    if (best && best.notifica_attiva === true) {
      asciugNotifiedRef.current.add(inside.id);
      onNotificaRistoro(best);
    }
  }, [posUtente, pois, onNotificaRistoro]);

  useEffect(() => {
    const tick = () => {
      const pos = posRef.current;
      if (!pos) return;

      valutaTuttiIPoi(poisFiltratiRef.current, pos, onNotificaAttrazione, onNotificaRistoro);
    };

    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, [onNotificaAttrazione, onNotificaRistoro]);

  // Auto-chiusura popup dopo 15 secondi se non c'è interazione
  useEffect(() => {
    if (!notificaAttiva) return;
    const t = window.setTimeout(() => setNotificaAttiva(null), 15_000);
    return () => window.clearTimeout(t);
  }, [notificaAttiva]);

  const motivoNotifica = useMemo(() => {
    if (!notificaAttiva) return "";
    if (notificaAttiva.tipo === "attrazione") {
      const t = notificaAttiva.tipoAttrazione;
      if (t === "post_pranzo") return "Giretto tranquillo post pranzo?";
      if (t === "ultimo_giro") return "Ultimo giro sulla tua attrazione preferita?";
      return "Coda sotto i 10 minuti!";
    }
    const trigger = notificaAttiva.poi.trigger;
    if (Array.isArray(trigger) && trigger.includes("caffe"))
      return "Tutte le attrazioni sono affollate, pausa caffè?";
    if (Array.isArray(trigger) && trigger.includes("gelato")) return "Sei vicino a un chiosco gelato!";
    return "Suggerimento ristoro.";
  }, [notificaAttiva]);

  const poiDebugAttrazione = useMemo(() => {
    const fromFiltered = poisFiltrati.find((p) => p.categoria === "attrazione");
    if (fromFiltered) return fromFiltered;
    return pois.find((p) => p.categoria === "attrazione") ?? null;
  }, [poisFiltrati, pois]);

  const poiDebugCaffe = useMemo(() => {
    const pick = (list: Poi[]) =>
      list.find((p) => p.categoria === "ristoro" && Array.isArray(p.trigger) && p.trigger.includes("caffe")) ??
      null;
    return pick(poisFiltrati) ?? pick(pois);
  }, [poisFiltrati, pois]);

  const fallbackPoiAttrazione: Poi = useMemo(
    () => ({
      id: "__debug_attrazione__",
      nome: "Demo attrazione",
      categoria: "attrazione",
      posizione: posFallback,
      notifica_attiva: false,
      orario_apertura: "10:00",
      orario_chiusura: "20:00",
      coda_minuti: 12,
    }),
    [posFallback],
  );

  const fallbackPoiCaffe: Poi = useMemo(
    () => ({
      id: "__debug_caffe__",
      nome: "Demo bar (caffè)",
      categoria: "ristoro",
      posizione: posFallback,
      notifica_attiva: false,
      orario_apertura: "10:00",
      orario_chiusura: "20:00",
      coda_minuti: 5,
      trigger: ["caffe"],
      alimenti: ["normale"],
    }),
    [posFallback],
  );

  if (!profilo) {
    return <Onboarding onComplete={setProfilo} />;
  }

  return (
    <main className="relative mx-auto w-full max-w-lg overflow-x-visible bg-[#000000] px-4 py-4">
      <AnimatePresence initial={false}>
        {poiPanelOpen ? (
          <motion.div
            className="fixed right-0 top-0 z-40"
            style={{ width: "50vw" }}
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
          >
            <div className="absolute right-2 top-2 z-50">
              <motion.button
                type="button"
                className="h-6 w-10 rounded-full bg-zinc-950/80 ring-1 ring-white/10 backdrop-blur"
                aria-label="Chiudi pannello POI"
                drag="y"
                dragSnapToOrigin
                dragElastic={0.12}
                onDragEnd={(_, info) => {
                  if (info.offset.y < -30 || info.velocity.y < -600) setPoiPanelOpen(false);
                }}
                onClick={() => setPoiPanelOpen(false)}
              />
            </div>

            <div className="pointer-events-auto">
              <POIList
                fullBleed={false}
                pois={poisFiltrati}
                posUtente={posUtente ?? posFallback}
                bellById={bellById}
                onToggleBell={(id) => {
                  setBellById((prev) => ({ ...prev, [id]: !(prev[id] === true) }));
                  setPois((prev) => prev.map((p) => (p?.id === id ? { ...p, notifica_attiva: !(p.notifica_attiva === true) } : p)));
                }}
                calcolaDistanzaM={(poiPos) => calcolaDistanza(posUtente ?? posFallback, poiPos)}
              />
            </div>
          </motion.div>
        ) : (
          <motion.button
            type="button"
            className="fixed right-2 top-2 z-40 h-6 w-10 rounded-full bg-zinc-950/80 ring-1 ring-white/10 backdrop-blur"
            aria-label="Apri pannello POI"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            drag="y"
            dragSnapToOrigin
            dragElastic={0.16}
            onDragEnd={(_, info) => {
              if (info.offset.y > 30 || info.velocity.y > 600) setPoiPanelOpen(true);
            }}
            onClick={() => setPoiPanelOpen(true)}
          />
        )}
      </AnimatePresence>

      <NotificationPopup
        open={notificaAttiva !== null}
        poi={notificaAttiva?.poi ?? null}
        tipo={notificaAttiva?.tipo}
        motivo={motivoNotifica}
        onChiudi={() => setNotificaAttiva(null)}
        onNaviga={(poi) => {
          if (poi.posizione) {
            window.open(`https://maps.google.com/?q=${poi.posizione.lat},${poi.posizione.lng}`, "_blank");
          }
          setNotificaAttiva(null);
        }}
      />

      {import.meta.env.DEV ? (
        <div className="fixed inset-x-0 bottom-2 z-50 mx-auto w-full max-w-lg px-4">
          <div className="rounded-2xl bg-zinc-950/80 ring-1 ring-white/10 backdrop-blur">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-zinc-100"
              onClick={() => setDebugPanelOpen((v) => !v)}
            >
              Debug
              <span className="text-xs font-normal text-zinc-400">{debugPanelOpen ? "Nascondi" : "Mostra"}</span>
            </button>

            {debugPanelOpen ? (
              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                <button
                  type="button"
                  className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
                  onClick={() => {
                    const first = pois.find((p) => p?.categoria === "attrazione") ?? fallbackPoiAttrazione;
                    onNotificaAttrazione(first);
                  }}
                >
                  Test notifica attrazione
                </button>

                <button
                  type="button"
                  className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
                  onClick={() => {
                    const first =
                      (pois.find(
                        (p) => p?.categoria === "ristoro" && Array.isArray(p.trigger) && p.trigger.includes("caffe"),
                      ) as Poi | undefined) ??
                      fallbackPoiCaffe;
                    onNotificaRistoro(first);
                  }}
                >
                  Test trigger caffè
                </button>

                <button
                  type="button"
                  className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
                  onClick={() => {
                    const first =
                      (pois.find((p) => p?.categoria === "attrazione" && (p as Poi)["intensità"] === "bassa") as Poi | undefined) ??
                      (pois.find((p) => p?.categoria === "attrazione") as Poi | undefined) ??
                      fallbackPoiAttrazione;
                    onNotificaAttrazione(first, "post_pranzo");
                  }}
                >
                  Test post pranzo
                </button>

                <button
                  type="button"
                  className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
                  onClick={() => {
                    const found =
                      (pois.find((p) => p?.categoria === "attrazione" && p.notifica_attiva === true) as Poi | undefined) ??
                      (pois.find((p) => p?.categoria === "attrazione") as Poi | undefined) ??
                      fallbackPoiAttrazione;
                    const mock = { ...found, notifica_attiva: true };
                    onNotificaAttrazione(mock, "ultimo_giro");
                  }}
                >
                  Test ultimo giro
                </button>

                <button
                  type="button"
                  className="col-span-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
                  onClick={() => setNotificaAttiva(null)}
                >
                  Chiudi popup
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

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
