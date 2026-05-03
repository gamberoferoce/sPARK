/**
 * Token flat UI condivisi con `POIList.tsx` / `App.tsx` (Launcher).
 * Valori letterali Tailwind → rgba (#27272a zinc-800 border card, ecc.).
 */

/** POIList: card pill */
export const CARD_BG = "rgba(0,0,0,0.45)";
/** POIList: bordo card / divisori */
export const LINE = "#27272a";
/** POIList: cerchio icona */
export const CIRCLE_BG = "rgba(0,0,0,0.55)";

/** App LauncherButton: pill principale */
export const LAUNCHER_BG = "rgba(0,0,0,0.45)";
export const LAUNCHER_BORDER = "#27272a";
/** hover:border-white/35 */
export const LAUNCHER_BORDER_HOVER = "rgba(255,255,255,0.35)";

/**
 * Tab attiva: `bg-zinc-600/50 … ring-1 ring-white/10`
 * zinc-600 #52525b
 */
export const TAB_ACTIVE_BG = "rgba(82,82,91,0.5)";
export const TAB_ACTIVE_RING = "rgba(255,255,255,0.1)";
/** Inattiva: testo bianco; hover approssimato per XR statico */
export const TAB_TEXT_ACTIVE = "rgba(255,255,255,1)";
export const TAB_TEXT_INACTIVE = "rgba(255,255,255,1)";

/** Distanza sotto titolo: `text-zinc-500` #71717a */
export const TEXT_ZINC_500 = "#71717a";
/** Placeholder — : `text-zinc-600` */
export const TEXT_ZINC_600 = "#52525b";

/** Closed badge: `text-zinc-200 … bg-zinc-800/70 ring-white/10` */
export const CLOSED_BADGE_BG = "rgba(39,39,42,0.7)";
export const CLOSED_BADGE_FG = "#e4e4e7";
export const CLOSED_BADGE_RING = "rgba(255,255,255,0.1)";

/** cerchio icona: `ring-white/70` */
export const ICON_RING = "rgba(255,255,255,0.7)";

/** Coda: allineato a `codaBadgeClass` in POIList */
export function waitBadgeColors(minuti: number) {
  if (minuti < 15) {
    return {
      bg: "rgba(6,78,59,0.7)",
      fg: "#6ee7b7",
      ring: "rgba(16,185,129,0.25)",
    };
  }
  if (minuti <= 45) {
    return {
      bg: "rgba(69,26,3,0.55)",
      fg: "#fde68a",
      ring: "rgba(245,158,11,0.25)",
    };
  }
  return {
    bg: "rgba(76,5,25,0.85)",
    fg: "#fecdd3",
    ring: "rgba(190,18,60,0.35)",
  };
}

/** Letter-spacing ~ `tracking-wide` su fs 14px → ~0.025em */
export function trackingWideEm(fontSizePx: number) {
  return fontSizePx * 0.025;
}

/** Body / titoli POI: `tracking-wide` su 15px */
export function bodyTrackingEm(fontSizePx: number) {
  return fontSizePx * 0.025;
}
