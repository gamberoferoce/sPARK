import type { Poi } from "@/types/poi";
import { useEffect, useRef } from "react";

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
              {attrazioni.map((a) => {
                const unlocked = badgesSbloccati.includes(a.id);
                const stickerSrc = stickerForRideId(a.id);

                return (
                  <div key={a.id} className="flex w-[88px] flex-col items-center">
                    <div
                      className="grid h-14 w-14 place-items-center rounded-full ring-1 ring-white/10"
                      style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                    >
                      <img
                        src={stickerSrc}
                        alt=""
                        className="h-12 w-12 object-contain"
                        style={{ opacity: unlocked ? 0.9 : 0.35, filter: unlocked ? "none" : "grayscale(0.2)" }}
                        draggable={false}
                      />
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attrazioni.map((a) => {
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
                className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-white/10 backdrop-blur"
              >
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={stickerSrc}
                    alt=""
                    className="h-[88px] w-full object-contain"
                    style={{ opacity: unlocked ? 0.9 : 0.35, filter: unlocked ? "none" : "grayscale(0.2)" }}
                    draggable={false}
                  />
                  <div className="w-full text-center text-[12px] font-semibold leading-snug text-zinc-100 line-clamp-2">
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

