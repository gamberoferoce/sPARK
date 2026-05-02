import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { POIList } from "@/components/POIList";
import { Onboarding, type ProfiloUtente } from "@/components/Onboarding";
import { NotificationPopup } from "@/components/NotificationPopup";
import { MiniMapOverlay } from "@/components/MiniMapOverlay";
import { BadgeScreen } from "@/components/BadgeScreen";
import { calcolaDistanza, valutaTriggerAsciugatura } from "@/core/algorithm.js";
import { valutaTuttiIPoi } from "@/core/notifications.js";
import { PARCO } from "@/core/config.js";
import type { Poi } from "@/types/poi";
import { filterPoisByProfile } from "@/lib/poiFilter";
import { FixedArtboard } from "@/components/FixedArtboard";

const ONBOARDING_BG_VIDEO = `${import.meta.env.BASE_URL}videos/onboarding-vegetation.mp4`;

function LauncherButton({
  kind,
  onChangeKind,
  onRelease,
}: {
  kind: "cards" | "badge";
  onChangeKind: (k: "cards" | "badge") => void;
  onRelease: (opts: { kind: "cards" | "badge"; wasDrag: boolean }) => void;
}) {
  const draggingRef = useRef(false);
  const startXRef = useRef<number | null>(null);
  const lastSetRef = useRef<"cards" | "badge" | null>(null);
  const [pressed, setPressed] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="fixed top-2 left-1/2 z-[86] -translate-x-1/2">
      <div className="relative h-10 w-10" aria-hidden={false}>
        {/* Visual cue: due simboli sfusi che "scorrono" verso l'icona */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: pressed ? 1 : 0,
            transition: "opacity 120ms ease",
          }}
        >
          {(() => {
            const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
            // movimento continuo: l'icona "sfusa" segue dx in modo proporzionale (clampato)
            const travelMax = 52; // max distance toward center
            const p = Math.min(1, Math.abs(dx) / travelMax);

            // Visual cue coerente:
            // - if Cards is selected, show Badges on the left (drag right to bring to center)
            // - if Badges is selected, show Cards on the right (drag left to bring to center)
            const showOtherOnLeft = kind === "cards";
            const incoming = showOtherOnLeft ? clamp(dx, 0, travelMax) : clamp(dx, -travelMax, 0);
            const opacity = 0.25 + 0.65 * p;
            const scale = 0.92 + 0.06 * p;
            const transition = dragging ? "none" : "transform 140ms ease, opacity 140ms ease";
            return (
              <>
                {showOtherOnLeft ? (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 rounded-full bg-zinc-950/70 text-zinc-100 ring-1 ring-white/10 backdrop-blur"
                    style={{
                      left: "-52px",
                      width: 36,
                      height: 36,
                      display: "grid",
                      placeItems: "center",
                      transform: `translate(${incoming}px, -50%) scale(${scale})`,
                      opacity,
                      transition,
                    }}
                  >
                    <img
                      src="/icons/tab-badges.png"
                      alt=""
                      className="h-5 w-5 select-none"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 rounded-full bg-zinc-950/70 text-zinc-100 ring-1 ring-white/10 backdrop-blur"
                    style={{
                      right: "-52px",
                      width: 36,
                      height: 36,
                      display: "grid",
                      placeItems: "center",
                      transform: `translate(${incoming}px, -50%) scale(${scale})`,
                      opacity,
                      transition,
                    }}
                  >
                    <img
                      src="/icons/tab-cards.svg"
                      alt=""
                      className="h-4 w-4 select-none"
                      style={{ filter: "invert(1)" }}
                      draggable={false}
                    />
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <button
          type="button"
        aria-label={kind === "badge" ? "Open badges" : "Open cards"}
          className="relative z-[1] grid h-10 w-10 place-items-center rounded-full bg-zinc-950/80 text-zinc-100 ring-1 ring-white backdrop-blur select-none transition-transform duration-150 hover:scale-[1.03] hover:ring-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            draggingRef.current = false;
            lastSetRef.current = null;
            startXRef.current = e.clientX;
            setPressed(true);
            setDx(0);
            setDragging(false);
          }}
          onPointerMove={(e) => {
            e.preventDefault();
            const sx = startXRef.current;
            if (sx == null) return;
            const nextDx = e.clientX - sx;
            setDx(nextDx);

            if (!draggingRef.current && Math.abs(nextDx) > 10) {
              draggingRef.current = true;
              setDragging(true);
            }
            if (!draggingRef.current) return;

            if (Math.abs(nextDx) < 26) return;
            const next: "cards" | "badge" = nextDx > 0 ? "badge" : "cards";
            if (lastSetRef.current !== next) {
              lastSetRef.current = next;
              onChangeKind(next);
            }
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            startXRef.current = null;
            setPressed(false);
            setDx(0);
            setDragging(false);
            const wasDrag = draggingRef.current;
            draggingRef.current = false;
            onRelease({ kind, wasDrag });
          }}
          onPointerCancel={() => {
            startXRef.current = null;
            draggingRef.current = false;
            setPressed(false);
            setDx(0);
            setDragging(false);
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {kind === "badge" ? (
            <img src="/icons/tab-badges.png" alt="" className="h-6 w-6 select-none" draggable={false} />
          ) : (
            <img
              src="/icons/tab-cards.svg"
              alt=""
              className="h-5 w-5 select-none"
              style={{ filter: "invert(1)" }}
              draggable={false}
            />
          )}
        </button>
      </div>
    </div>
  );
}

function App() {
  const [pois, setPois] = useState<Poi[]>([]);
  const poisRef = useRef<Poi[]>([]);
  const [profilo, setProfilo] = useState<ProfiloUtente | null>(() => {
    try {
      const raw = localStorage.getItem("profiloUtente");
      if (!raw) return null;
      const p = JSON.parse(raw) as unknown;
      if (!p || typeof p !== "object") return null;
      const o = p as Record<string, unknown>;
      if (typeof o.altezza_cm !== "number" || !Array.isArray(o.intensita) || !Array.isArray(o.diete)) return null;
      return p as ProfiloUtente;
    } catch {
      return null;
    }
  });
  const [bellById, setBellById] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("sparkBellById");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  const [notificaAttiva, setNotificaAttiva] = useState<{
    poi: Poi;
    tipo: "attrazione" | "ristoro";
    tipoAttrazione?: "attrazione" | "post_pranzo" | "ultimo_giro";
    motivoOverride?: string;
  } | null>(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [poiPanelOpen, setPoiPanelOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapDest, setMapDest] = useState<Poi | null>(null);
  const [badgeScreenOpen, setBadgeScreenOpen] = useState(false);
  const [launcherKind, setLauncherKind] = useState<"cards" | "badge">(() => {
    try {
      const v = localStorage.getItem("launcherKind");
      return v === "badge" ? "badge" : "cards";
    } catch {
      return "cards";
    }
  });
  const [badgesSbloccati, setBadgesSbloccati] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("badgesSbloccati");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });

  const posFallback: Poi["posizione"] = useMemo(
    () => ({ lat: 45.4631, lng: 9.1894 }),
    [],
  );
  const [posUtente, setPosUtente] = useState<Poi["posizione"] | null>(() => {
    try {
      const raw = localStorage.getItem("lastUserPos");
      if (!raw) return null;
      const p = JSON.parse(raw) as unknown;
      if (!p || typeof p !== "object" || p === null) return null;
      const o = p as Record<string, unknown>;
      if (typeof o.lat === "number" && typeof o.lng === "number") return { lat: o.lat, lng: o.lng };
    } catch {
      // ignore
    }
    return null;
  });

  const [parcoClosed, setParcoClosed] = useState<boolean>(false);
  const lastQueueTimesOkRef = useRef<number>(0);

  function parseYmd(ymd: string) {
    const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    return new Date(y, mo - 1, d);
  }

  function parseHm(hm: string) {
    const m = String(hm).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function isParcoOpenNow(now = new Date()) {
    const start = parseYmd(PARCO.stagione.inizio);
    const end = parseYmd(PARCO.stagione.fine);
    if (!start || !end) return true;

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (today < start || today > end) return false;

    const openMin = parseHm(PARCO.orario_apertura) ?? 0;
    const closeMin = parseHm(PARCO.orario_chiusura_default) ?? 24 * 60;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return nowMin >= openMin && nowMin < closeMin;
  }

  useEffect(() => {
    poisRef.current = pois;
  }, [pois]);

  useEffect(() => {
    if (!profilo) return;
    try {
      localStorage.setItem("profiloUtente", JSON.stringify(profilo));
    } catch {
      // ignore
    }
  }, [profilo]);

  useEffect(() => {
    try {
      localStorage.setItem("sparkBellById", JSON.stringify(bellById));
    } catch {
      // ignore
    }
  }, [bellById]);

  // Park open/closed logic (season + opening hours)
  useEffect(() => {
    const tick = () => {
      // If Queue-Times is updating, treat it as source of truth for open/closed.
      if (Date.now() - lastQueueTimesOkRef.current < 10 * 60 * 1000) return;
      setParcoClosed(isParcoOpenNow(new Date()) === false);
    };
    tick();
    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const attrazioniConBadge = useMemo(
    () => pois.filter((p) => p?.categoria === "attrazione" && !!p.badge),
    [pois],
  );

  const tuttiBadgeSbloccati = useMemo(() => {
    if (attrazioniConBadge.length === 0) return false;
    return attrazioniConBadge.every((a) => badgesSbloccati.includes(a.id));
  }, [attrazioniConBadge, badgesSbloccati]);

  const [confettiOn, setConfettiOn] = useState(false);

  useEffect(() => {
    if (!tuttiBadgeSbloccati) return;
    try {
      const shown = localStorage.getItem("premioMostrato") === "1";
      if (shown) return;
      localStorage.setItem("premioMostrato", "1");
    } catch {
      // ignore
    }

    const poiPremio = attrazioniConBadge[0] ?? pois.find((p) => p?.categoria === "attrazione") ?? null;
    if (poiPremio) {
      setNotificaAttiva({
        poi: poiPremio,
        tipo: "attrazione",
        motivoOverride: "Ritira il tuo premio all'uscita!",
      });
    }
    setConfettiOn(true);
    window.setTimeout(() => setConfettiOn(false), 2600);
  }, [tuttiBadgeSbloccati, attrazioniConBadge, pois]);

  useEffect(() => {
    try {
      localStorage.setItem("badgesSbloccati", JSON.stringify(badgesSbloccati));
    } catch {
      // ignore
    }
  }, [badgesSbloccati]);

  useEffect(() => {
    try {
      localStorage.setItem("launcherKind", launcherKind);
    } catch {
      // ignore
    }
  }, [launcherKind]);

  const sbloccaBadge = useCallback((attrazioneId: string) => {
    setBadgesSbloccati((prev) => (prev.includes(attrazioneId) ? prev : [...prev, attrazioneId]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/poi.json")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const loaded = Array.isArray(data) ? (data as Poi[]) : [];
        setPois(loaded);
        const initial: Record<string, boolean> = {};
        try {
          const raw = localStorage.getItem("sparkBellById");
          const parsed = raw ? JSON.parse(raw) : {};
          if (parsed && typeof parsed === "object") Object.assign(initial, parsed as Record<string, boolean>);
        } catch {
          // ignore
        }
        for (const p of loaded) {
          if (p && typeof p.id === "string" && !(p.id in initial)) initial[p.id] = p.notifica_attiva === true;
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

  // Queue-Times.com integration (Europa-Park live wait times)
  useEffect(() => {
    const normalizeName = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ");

    const normalizeRideName = (s: string) => {
      // Queue-Times sometimes includes helper prefixes (e.g. "VirtualLine: ...")
      const cleaned = String(s).replace(/^virtual\s*line:\s*/i, "").replace(/^virtualline:\s*/i, "");
      return normalizeName(cleaned);
    };

    const tick = async () => {
      try {
        const base = import.meta.env.DEV
          ? "/queue-times"
          : "https://queue-times-proxy.giuliafanasca.workers.dev/api/queue-times";
        const res = await fetch(`${base}/parks/${PARCO.queue_times_park_id}/queue_times.json`);
        if (!res.ok) return;
        const data = (await res.json()) as unknown;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lands = Array.isArray((data as any)?.lands) ? ((data as any).lands as any[]) : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rides: any[] = [];
        for (const l of lands) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rs = Array.isArray((l as any)?.rides) ? ((l as any).rides as any[]) : [];
          rides.push(...rs);
        }
        if (rides.length === 0) return;

        // Queue-Times open/closed truth: if all rides are closed, treat park as closed.
        lastQueueTimesOkRef.current = Date.now();
        const allClosed = rides.every((r) => r && r.is_open === false);
        setParcoClosed(allClosed);

        const currentPois = poisRef.current;
        const poiByNameKey = new Map<string, string>();
        for (const p of currentPois) {
          if (!p?.id || typeof p.nome !== "string") continue;
          poiByNameKey.set(normalizeName(p.nome), p.id);
        }

        const updates = new Map<string, number>();
        for (const r of rides) {
          const name = typeof r?.name === "string" ? (r.name as string) : "";
          if (!name) continue;
          const poiId = poiByNameKey.get(normalizeRideName(name));
          if (!poiId) continue;

          if (r?.is_open === false) {
            updates.set(poiId, -1);
            continue;
          }
          if (r?.is_open !== true) continue;

          const wait = typeof r?.wait_time === "number" ? (r.wait_time as number) : null;
          if (wait == null || !Number.isFinite(wait)) continue;
          updates.set(poiId, Math.max(0, Math.round(wait)));
        }

        if (updates.size === 0) return;
        setPois((prev) =>
          prev.map((p) => {
            const next = updates.get(p.id);
            if (next == null) return p;
            return { ...p, coda_minuti: next };
          }),
        );
      } catch {
        // ignore
      }
    };

    tick();
    const id = window.setInterval(tick, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // Ottiene e aggiorna posUtente via geolocalizzazione
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosUtente(next);
        try {
          localStorage.setItem("lastUserPos", JSON.stringify(next));
        } catch {
          // ignore
        }
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
    return filterPoisByProfile(pois, profilo);
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
          if (p.categoria === "ristoro") return { ...p, coda_minuti: randomInt(0, 25) };
          if (p.categoria === "wc") return { ...p, coda_minuti: randomInt(0, 5) };
          if (p.categoria === "asciugatura") return { ...p, coda_minuti: randomInt(0, 5) };
          return p; // non toccare attrazioni (arrivano da Queue-Times)
        }),
      );
    }, 90 * 1000);

    return () => window.clearInterval(id);
  }, []);

  // Notifications: every 60s run valutaTuttiIPoi (only if posUtente is available)
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
      if (import.meta.env.DEV) console.log("[NOTIFICA][ATTRAZIONE]", poi);
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
    if (import.meta.env.DEV) console.log("[NOTIFICA][RISTORO]", poi);
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
    const asciugature = pois.filter((p) => p?.categoria === "asciugatura");

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
      // Punchline dedicata asciugatura
      setPoiPanelOpen(false);
      setNotificaAttiva({ poi: best, tipo: "ristoro", motivoOverride: "Ti asciughi qui vicino?" });
      navigator.vibrate?.(200);
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

  // Auto-close popup after 15s if no interaction
  useEffect(() => {
    if (!notificaAttiva) return;
    const t = window.setTimeout(() => setNotificaAttiva(null), 15_000);
    return () => window.clearTimeout(t);
  }, [notificaAttiva]);

  const motivoNotifica = useMemo(() => {
    if (!notificaAttiva) return "";
    if (notificaAttiva.motivoOverride) return notificaAttiva.motivoOverride;
    if (notificaAttiva.tipo === "attrazione") {
      const t = notificaAttiva.tipoAttrazione;
      if (t === "post_pranzo") return "Giretto tranquillo post pranzo?";
      if (t === "ultimo_giro") return "Ultimo giro sulla tua attrazione preferita?";
      return "Coda sotto i 10 minuti!";
    }
    const trigger = notificaAttiva.poi.trigger;
    if (Array.isArray(trigger) && trigger.includes("caffe"))
      return "All rides are crowded — coffee break?";
    if (Array.isArray(trigger) && trigger.includes("merenda")) return "Snack break nearby?";
    return "Suggerimento ristoro.";
  }, [notificaAttiva]);

  function formatDistanza(metri: number) {
    if (!Number.isFinite(metri)) return "—";
    if (metri < 1000) return `${Math.round(metri)} m`;
    return `${(metri / 1000).toFixed(1)} km`;
  }

  const sottotitoloNotifica = useMemo(() => {
    if (!notificaAttiva) return "";
    const pos = posUtente ?? posFallback;
    const d = calcolaDistanza(pos, notificaAttiva.poi.posizione);
    return `${notificaAttiva.poi.nome} • ${formatDistanza(d)}`;
  }, [notificaAttiva, posUtente, posFallback]);

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
      nome: "Demo bar (coffee)",
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
    return (
      <div className="relative isolate min-h-[100dvh] w-full">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-black" aria-hidden>
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            src={ONBOARDING_BG_VIDEO}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
          <div className="absolute inset-0 bg-black/35" />
        </div>
        <Onboarding onComplete={setProfilo} />
      </div>
    );
  }

  return (
    <main className="relative mx-auto w-full max-w-lg overflow-x-visible px-4 py-4">
      {/* Background video */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
        <video
          className="h-full w-full object-cover opacity-90"
          src="/videos/bg.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="absolute inset-0 bg-black/35" />
      </div>
      {/* Launcher unico: tap apre, press+drag orizzontale cambia scheda */}
      <LauncherButton
        kind={launcherKind}
        onChangeKind={setLauncherKind}
        onRelease={({ kind, wasDrag }) => {
          // Rilascio dopo drag: apri sempre la scheda selezionata e chiudi l'altra.
          if (wasDrag) {
            if (kind === "badge") {
              setPoiPanelOpen(false);
              setBadgeScreenOpen(true);
            } else {
              setBadgeScreenOpen(false);
              setPoiPanelOpen(true);
            }
            return;
          }

          // Tap: if the selected sheet is already open, close everything.
          const isSelectedOpen = kind === "badge" ? badgeScreenOpen : poiPanelOpen;
          if (isSelectedOpen) {
            setPoiPanelOpen(false);
            setBadgeScreenOpen(false);
            return;
          }

          // Altrimenti apri la scheda selezionata e chiudi l'altra se era aperta.
          if (kind === "badge") {
            setPoiPanelOpen(false);
            setBadgeScreenOpen(true);
          } else {
            setBadgeScreenOpen(false);
            setPoiPanelOpen(true);
          }
        }}
      />

      {poiPanelOpen ? (
        <div
          className="fixed left-1/2 top-14 z-40 overflow-visible transition-transform duration-300 ease-out"
          style={{ transform: "translateX(calc(-50% - 3px))" }}
        >
          <FixedArtboard>
            <div className="pointer-events-auto w-full max-w-lg">
              <POIList
                fullBleed={false}
                pois={poisFiltrati}
                posUtente={posUtente ?? posFallback}
                bellById={bellById}
                parcoClosed={parcoClosed}
                onToggleBell={(id) => {
                  setBellById((prev) => ({ ...prev, [id]: !(prev[id] === true) }));
                  setPois((prev) =>
                    prev.map((p) => (p?.id === id ? { ...p, notifica_attiva: !(p.notifica_attiva === true) } : p)),
                  );
                }}
                onNaviga={(poi) => {
                  setPoiPanelOpen(false);
                  setMapDest(poi);
                  setMapOpen(true);
                }}
                calcolaDistanzaM={(poiPos) => calcolaDistanza(posUtente ?? posFallback, poiPos)}
              />
            </div>
          </FixedArtboard>
        </div>
      ) : null}

      <NotificationPopup
        open={notificaAttiva !== null}
        poi={notificaAttiva?.poi ?? null}
        motivo={motivoNotifica}
        sottotitolo={sottotitoloNotifica}
        onChiudi={() => setNotificaAttiva(null)}
        onNaviga={(poi) => {
          setNotificaAttiva(null);
          setMapDest(poi);
          setMapOpen(true);
        }}
      />

      <MiniMapOverlay
        open={mapOpen}
        posUtente={posUtente ?? posFallback}
        destinazione={mapDest}
        onClose={() => {
          setMapOpen(false);
          setMapDest(null);
        }}
      />

      {/* Badge sheet */}
      <BadgeScreen
        open={badgeScreenOpen}
        attrazioni={attrazioniConBadge}
        badgesSbloccati={badgesSbloccati}
        onBadgeUnlocked={sbloccaBadge}
        onClose={() => setBadgeScreenOpen(false)}
      />

      {/* Confetti CSS puri */}
      {confettiOn ? (
        <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
          <style>{`
@keyframes confettiFall{0%{transform:translate3d(var(--x),-10vh,0) rotate(0deg);opacity:1}100%{transform:translate3d(calc(var(--x) + var(--dx)),110vh,0) rotate(var(--rot));opacity:.9}}
`}</style>
          {Array.from({ length: 42 }).map((_, i) => {
            const colors = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#22c55e"];
            const size = 6 + (i % 7);
            const left = (i * 37) % 100;
            const dx = ((i % 9) - 4) * 18;
            const rot = ((i % 11) - 5) * 90;
            const dur = 1200 + (i % 13) * 90;
            const delay = (i % 7) * 30;
            return (
              <div
                key={i}
                style={
                  {
                    position: "absolute",
                    left: `${left}%`,
                    top: "-10vh",
                    width: `${size}px`,
                    height: `${Math.round(size * 1.2)}px`,
                    borderRadius: "3px",
                    background: colors[i % colors.length]!,
                    opacity: 0.95,
                    animation: `confettiFall ${dur}ms cubic-bezier(0.2,0.8,0.2,1) ${delay}ms forwards`,
                    ["--x" as any]: `${left}vw`,
                    ["--dx" as any]: `${dx}px`,
                    ["--rot" as any]: `${rot}deg`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      ) : null}

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
                  Test coffee trigger
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
                  Close popup
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
