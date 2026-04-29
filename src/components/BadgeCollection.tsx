import type { Poi } from "@/types/poi";
import { useRef } from "react";

type Props = {
  attrazioni: Poi[];
  badgesSbloccati: string[];
  showHeader?: boolean;
  variant?: "grid" | "row";
};

export function BadgeCollection({
  attrazioni,
  badgesSbloccati,
  showHeader = true,
  variant = "grid",
}: Props) {
  const totale = attrazioni.length;
  const sbloccati = attrazioni.filter((a) => badgesSbloccati.includes(a.id)).length;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number; pointerId: number | null }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    pointerId: null,
  });

  return (
    <div className={variant === "grid" ? "px-4 pt-4 pb-28" : "px-4 pt-4 pb-8"}>
      {showHeader ? (
        <div className="mb-4 flex items-baseline justify-between">
          <div className="text-sm font-semibold text-zinc-100">Badge collection</div>
          <div className="text-xs text-zinc-400">
            {sbloccati}/{totale} badges unlocked
          </div>
        </div>
      ) : null}

      {variant === "row" ? (
        <div className="relative">
          <div
            ref={rowRef}
            className="overflow-x-auto overflow-y-hidden pt-2 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none"
            style={{
              cursor: dragRef.current.active ? "grabbing" : "grab",
              touchAction: "pan-y",
              // only the center reaches full opacity; sides always fade
              maskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 22%, black 50%, rgba(0,0,0,0.15) 78%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 22%, black 50%, rgba(0,0,0,0.15) 78%, transparent 100%)",
            }}
            onPointerDown={(e) => {
              const el = rowRef.current;
              if (!el) return;
              // only left-click for mouse
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((e as any).button != null && (e as any).button !== 0) return;
              el.setPointerCapture(e.pointerId);
              dragRef.current.active = true;
              dragRef.current.pointerId = e.pointerId;
              dragRef.current.startX = e.clientX;
              dragRef.current.startScrollLeft = el.scrollLeft;
            }}
            onPointerMove={(e) => {
              const el = rowRef.current;
              if (!el) return;
              if (!dragRef.current.active) return;
              const dx = e.clientX - dragRef.current.startX;
              el.scrollLeft = dragRef.current.startScrollLeft - dx;
            }}
            onPointerUp={() => {
              dragRef.current.active = false;
              dragRef.current.pointerId = null;
            }}
            onPointerCancel={() => {
              dragRef.current.active = false;
              dragRef.current.pointerId = null;
            }}
          >
            <div className="flex w-max gap-4 pr-4 ml-auto">
              {attrazioni.map((a) => {
                const unlocked = badgesSbloccati.includes(a.id);
                const badge = a.badge;
                const colore = unlocked && badge?.colore ? badge.colore : "#3f3f46";

                return (
                  <div key={a.id} className="flex w-[88px] flex-col items-center">
                    <div
                      className="grid h-14 w-14 place-items-center rounded-full ring-1 ring-white/10"
                      style={{ backgroundColor: unlocked ? colore + "22" : "rgba(255,255,255,0.05)" }}
                    >
                      <div
                        className="grid h-9 w-9 place-items-center rounded-2xl"
                        style={{
                          backgroundColor: unlocked ? colore : "#3f3f46",
                          boxShadow: unlocked ? `0 0 16px ${colore}55` : "none",
                        }}
                        aria-hidden
                      >
                        {!unlocked ? <span className="text-sm font-semibold text-zinc-100">?</span> : null}
                      </div>
                    </div>
                    <div className="mt-2 text-center text-[11px] font-semibold leading-snug text-zinc-100 line-clamp-2">
                      {a.nome}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {attrazioni.map((a) => {
            const unlocked = badgesSbloccati.includes(a.id);
            const badge = a.badge;
            const colore = unlocked && badge?.colore ? badge.colore : "#3f3f46";

            return (
              <div key={a.id} className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-11 w-11 place-items-center rounded-xl ring-1 ring-white/10"
                    style={{ backgroundColor: colore + "22" }}
                  >
                    <div className="h-6 w-6 rounded-lg" style={{ backgroundColor: colore }} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">{unlocked ? badge?.nome ?? a.nome : "???"}</div>
                    <div className="mt-0.5 truncate text-xs text-zinc-400">{unlocked ? a.nome : "Badge bloccato"}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

