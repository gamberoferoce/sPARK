import type { Poi } from "@/types/poi";
import { useEffect, useRef } from "react";
import { DRIFT_FLOAT_ON_HOVER_CLASS } from "@/components/motion";
import { cn } from "@/lib/utils";

const STICKERS = [
  "/stickers/sticker-1.png",
  "/stickers/sticker-2.png",
  "/stickers/sticker-3.png",
  "/stickers/sticker-4.png",
  "/stickers/sticker-5.png",
] as const;

function hashString(s: string) {
  // Small deterministic hash to pick a sticker per ride (stable across sessions).
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stickerForRideId(id: string) {
  const idx = STICKERS.length ? hashString(id) % STICKERS.length : 0;
  return STICKERS[idx] ?? STICKERS[0]!;
}

type Props = {
  attrazioni: Poi[];
  badgesSbloccati: string[];
  showHeader?: boolean;
  variant?: "grid" | "row";
  focusId?: string | null;
};

export function BadgeCollection({
  attrazioni,
  badgesSbloccati,
  showHeader = true,
  variant = "grid",
  focusId = null,
}: Props) {
  const totale = attrazioni.length;
  const sbloccati = attrazioni.filter((a) => badgesSbloccati.includes(a.id)).length;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number; pointerId: number | null }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    pointerId: null,
  });

  useEffect(() => {
    if (!focusId) return;
    const el = itemRefs.current.get(focusId);
    if (!el) return;

    // Scroll the card into view (BadgeScreen is the scroll container)
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    // Add a quick highlight motion
    try {
      el.animate(
        [
          { transform: "translateZ(0) scale(1)", boxShadow: "0 0 0 rgba(255,255,255,0)" },
          { transform: "translateZ(0) scale(1.06)", boxShadow: "0 0 28px rgba(255,255,255,0.22)" },
          { transform: "translateZ(0) scale(0.99)", boxShadow: "0 0 18px rgba(255,255,255,0.18)" },
          { transform: "translateZ(0) scale(1)", boxShadow: "0 0 0 rgba(255,255,255,0)" },
        ],
        { duration: 750, easing: "cubic-bezier(0.2, 0.9, 0.2, 1)", iterations: 1 },
      );
    } catch {
      // ignore
    }
  }, [focusId]);

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
              {attrazioni.map((a, idx) => {
                const unlocked = badgesSbloccati.includes(a.id);
                const stickerSrc = stickerForRideId(a.id);

                return (
                  <div
                    key={a.id}
                    className={cn(
                      "group flex w-[88px] flex-col items-center rounded-xl pb-1 pt-0.5 transition-[transform] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] motion-safe:will-change-transform motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:rotate-0 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.06]",
                      idx % 2 === 0
                        ? "motion-safe:hover:-rotate-[3deg]"
                        : "motion-safe:hover:rotate-[3deg]",
                    )}
                  >
                    <div
                      className="grid h-14 w-14 place-items-center rounded-full ring-1 ring-white/10 transition-[transform,box-shadow,ring-color] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] motion-safe:group-hover:shadow-[0_14px_36px_-8px_rgba(255,255,255,0.22),0_6px_16px_-6px_rgba(0,0,0,0.65)] motion-safe:group-hover:ring-white/45"
                      style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                    >
                      <img
                        src={stickerSrc}
                        alt=""
                        className={cn(
                          DRIFT_FLOAT_ON_HOVER_CLASS,
                          "h-12 w-12 object-contain motion-safe:group-hover:drop-shadow-[0_4px_12px_rgba(255,255,255,0.35)]",
                        )}
                        style={{ opacity: unlocked ? 0.9 : 0.35, filter: unlocked ? "none" : "grayscale(0.2)" }}
                        draggable={false}
                      />
                    </div>
                    <div className="mt-2 text-center text-[11px] font-semibold leading-snug text-zinc-100 transition-colors duration-300 motion-safe:group-hover:text-white line-clamp-2">
                      {a.nome}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 [perspective:1000px] sm:grid-cols-3">
          {attrazioni.map((a, idx) => {
            const unlocked = badgesSbloccati.includes(a.id);
            const stickerSrc = stickerForRideId(a.id);

            return (
              <div
                key={a.id}
                ref={(node) => {
                  if (!node) {
                    itemRefs.current.delete(a.id);
                    return;
                  }
                  itemRefs.current.set(a.id, node);
                }}
                className={cn(
                  "group relative rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-white/10 backdrop-blur transition-[transform,box-shadow,ring-color] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] motion-safe:will-change-transform motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 motion-reduce:hover:rotate-0 motion-safe:hover:z-[2] motion-safe:hover:-translate-y-2 motion-safe:hover:scale-[1.035] motion-safe:hover:ring-white/35 motion-safe:hover:shadow-[0_22px_56px_-18px_rgba(255,255,255,0.12),0_12px_32px_-14px_rgba(0,0,0,0.75)]",
                  idx % 2 === 0
                    ? "motion-safe:hover:-rotate-[2.5deg]"
                    : "motion-safe:hover:rotate-[2.5deg]",
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={stickerSrc}
                    alt=""
                    className={cn(
                      DRIFT_FLOAT_ON_HOVER_CLASS,
                      "h-[88px] w-full origin-center object-contain motion-safe:group-hover:brightness-110",
                    )}
                    style={{ opacity: unlocked ? 0.9 : 0.35, filter: unlocked ? "none" : "grayscale(0.2)" }}
                    draggable={false}
                  />
                  <div className="w-full text-center text-[12px] font-semibold leading-snug text-zinc-100 transition-colors duration-300 motion-safe:group-hover:text-white line-clamp-2">
                    {a.nome}
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

