import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Bell, MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Poi, Categoria } from "@/types/poi";

type Props = {
  pois: Poi[];
  posUtente: Poi["posizione"];
  bellById: Record<string, boolean>;
  onToggleBell: (id: string) => void;
  calcolaDistanzaM: (poiPos: Poi["posizione"]) => number;
  fullBleed?: boolean;
};

type Tab = Categoria;

/** Screenshot: nero pieno */
const BG = "#000000";
/** Card: grigio molto scuro, appena sopra il nero */
const CARD_BG = "#0a0a0a";
/** Bordo sottile card / divisori */
const LINE = "#27272a";
/** Cerchio icona / campanella */
const CIRCLE_BG = "#18181b";

function formatDistanza(metri: number) {
  if (!Number.isFinite(metri)) return "—";
  if (metri < 1000) return `${Math.round(metri)} m`;
  return `${(metri / 1000).toFixed(1)} km`;
}

function codaBadgeClass(minuti: number) {
  if (minuti < 15) {
    return "bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-500/25";
  }
  if (minuti <= 45) {
    return "bg-amber-950/55 text-amber-200 ring-1 ring-amber-500/25";
  }
  return "bg-rose-950/85 text-rose-200 ring-1 ring-rose-700/35";
}

export function POIList({
  pois,
  posUtente: _posUtente,
  bellById,
  onToggleBell,
  calcolaDistanzaM,
  fullBleed = true,
}: Props) {
  const [tab, setTab] = useState<Tab>("attrazione");
  const swipeRef = useRef<{ x: number; y: number; pointerType: string } | null>(null);
  const firstLiRef = useRef<HTMLLIElement | null>(null);
  const [panelMaxH, setPanelMaxH] = useState<number | null>(null);

  const filtered = useMemo(() => pois.filter((p) => p && p.categoria === tab), [pois, tab]);

  const sorted = useMemo(() => {
    const list = filtered.map((p) => ({
      p,
      m: calcolaDistanzaM(p.posizione),
      bell: bellById[p.id] === true,
      coda: Number(p.coda_minuti),
    }));
    list.sort((a, b) => {
      if (a.bell !== b.bell) return a.bell ? -1 : 1;
      const ac = Number.isFinite(a.coda) ? a.coda : 9999;
      const bc = Number.isFinite(b.coda) ? b.coda : 9999;
      if (ac !== bc) return ac - bc;
      if (a.m !== b.m) return a.m - b.m;
      return a.p.nome.localeCompare(b.p.nome, "it");
    });
    return list;
  }, [filtered, bellById, calcolaDistanzaM]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "attrazione", label: "Attrazioni" },
    { id: "ristoro", label: "Ristoranti" },
    { id: "servizi", label: "Servizi" },
  ];

  useLayoutEffect(() => {
    if (fullBleed) return;
    const el = firstLiRef.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      if (!rect.height || rect.height < 1) return;
      // 6 elementi + gap tra le card (mt-5 ≈ 20px) + padding lista/tab
      const approx = Math.round(rect.height * 6 + 20 * 5 + 24);
      setPanelMaxH(approx);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullBleed, tab, sorted.length]);

  function handleSwipeEnd(clientX: number, clientY: number) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    // Swipe tabs: solo touch/pen, non mouse (evita trigger mentre clicchi).
    if (start.pointerType === "mouse") return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    // Richiedi intenzione orizzontale chiara
    if (Math.abs(dx) < 70) return;
    if (Math.abs(dy) > 40) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.4) return;

    const idx = tabs.findIndex((t) => t.id === tab);
    if (idx < 0) return;
    const nextIdx = dx < 0 ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
    setTab(tabs[nextIdx]!.id);
  }

  return (
    <div
      className={cn(fullBleed ? "-mx-4 w-[calc(100%+2rem)] max-w-none" : "w-full", "pb-28 antialiased")}
      style={{ backgroundColor: BG, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement | null;
        // Non iniziare swipe se stai interagendo con un bottone (tab, campanella, ecc.)
        if (target?.closest("button")) return;
        swipeRef.current = { x: e.clientX, y: e.clientY, pointerType: e.pointerType };
      }}
      onPointerUp={(e) => handleSwipeEnd(e.clientX, e.clientY)}
      onPointerCancel={() => {
        swipeRef.current = null;
      }}
    >
      {/* Tab: tre colonne equamente spaziate; attiva = capsula grigia + padding generoso */}
      <nav
        className="grid w-full grid-cols-3 items-center justify-items-stretch px-4 pt-0.5"
        aria-label="Filtri categoria"
      >
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <div key={t.id} className="flex justify-center px-0.5">
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "min-h-[36px] w-full max-w-[132px] whitespace-nowrap text-center text-[14px] leading-tight transition-colors duration-150",
                  on
                    ? "rounded-full px-4 py-2 font-normal text-white bg-zinc-600/50 shadow-inner shadow-black/20 ring-1 ring-white/10 hover:bg-zinc-500/50"
                    : "rounded-full bg-transparent px-2 py-2 font-normal text-white hover:bg-white/[0.08] hover:text-zinc-100",
                )}
              >
                {t.label}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Spazio sotto tab prima della lista */}
      <div className="h-4" aria-hidden />

      {/* Lista */}
      <ul
        className={cn(
          "flex w-full flex-col pt-4",
          fullBleed
            ? "overflow-visible"
            : "overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
        style={{
          backgroundColor: BG,
          maxHeight: !fullBleed && panelMaxH ? `${panelMaxH}px` : undefined,
          // Fade bottom: suggerisce scroll con rotella
          WebkitMaskImage: !fullBleed
            ? "linear-gradient(to bottom, rgba(0,0,0,1) 84%, rgba(0,0,0,0))"
            : undefined,
          maskImage: !fullBleed
            ? "linear-gradient(to bottom, rgba(0,0,0,1) 84%, rgba(0,0,0,0))"
            : undefined,
        }}
      >
        {sorted.map(({ p, m }, idx) => {
          const coda = Number(p.coda_minuti);
          const hasCoda = Number.isFinite(coda);
          const bellOn = bellById[p.id] === true;
          const showCoda = hasCoda && tab !== "servizi";

          return (
            <li
              key={p.id}
              ref={idx === 0 ? firstLiRef : undefined}
              className={cn("w-full overflow-visible", idx > 0 && "mt-5")}
              style={{ backgroundColor: BG }}
            >
              {/* Card pill: padding generoso; campanella metà sopra il bordo superiore */}
              <div className="px-4">
                <div
                  className="relative w-full overflow-visible rounded-full py-2.5 pl-3.5 pr-10"
                  style={{
                    backgroundColor: CARD_BG,
                    border: `1px solid ${LINE}`,
                  }}
                >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: CIRCLE_BG }}
                    aria-hidden
                  >
                    <Sparkles className="size-[17px] text-white" strokeWidth={2.25} />
                  </span>

                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[15px] font-normal leading-snug tracking-tight text-white">
                      {p.nome}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] font-normal leading-none text-zinc-500">
                      <MapPin className="size-[13px] shrink-0 text-white opacity-90" aria-hidden />
                      <span>{formatDistanza(m)}</span>
                    </div>
                  </div>

                  <div className="shrink-0 pl-0.5 translate-x-1.5">
                    {showCoda ? (
                      <span
                        className={cn(
                          "inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-0.5 text-[12px] font-normal tabular-nums leading-tight tracking-tight",
                          codaBadgeClass(coda),
                        )}
                      >
                        {coda} min
                      </span>
                    ) : (
                      <span className="inline-flex min-w-[3rem] justify-center text-[12px] text-zinc-600">
                        —
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleBell(p.id)}
                  className={cn(
                    "absolute z-30 flex size-9 items-center justify-center rounded-full text-white transition-all duration-200",
                    "backdrop-blur-xl backdrop-saturate-150",
                    "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.22)]",
                    // ON = look glass attuale (più evidente)
                    bellOn
                      ? "ring-1 ring-white/10 bg-gradient-to-br from-white/[0.22] via-white/[0.10] to-white/[0.04] hover:from-white/[0.26] hover:via-white/[0.12] hover:to-white/[0.06]"
                      : "ring-1 ring-white/5 bg-gradient-to-br from-white/[0.10] via-white/[0.05] to-white/[0.02] opacity-55 hover:opacity-75",
                  )}
                  style={{
                    right: "0.2rem",
                    top: 8,
                    transform: "translateY(-50%)",
                  }}
                  aria-pressed={bellOn}
                  aria-label={bellOn ? "Disattiva notifiche" : "Attiva notifiche"}
                >
                  <Bell className={cn("size-[15px] drop-shadow-sm", !bellOn && "opacity-60")} strokeWidth={2.25} />
                </button>
                </div>
              </div>

              {/* aria: spazio dopo ultima card */}
              {idx === sorted.length - 1 ? <div className="h-1" /> : null}
            </li>
          );
        })}
      </ul>

      {sorted.length === 0 ? (
        <p className="px-8 py-10 text-center text-sm text-zinc-500">Nessun elemento in questa categoria.</p>
      ) : null}
    </div>
  );
}
