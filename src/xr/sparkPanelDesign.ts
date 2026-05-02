/**
 * sPARK XR — Spark panel design tokens (UIKit layout px).
 *
 * The panel is a fixed “artboard”: no percentages against the WebGL canvas.
 * Only uniform `scale` on the root Container maps this design into world space.
 */
export const XR_PANEL = {
  w: 920,
  /** Total stack height: launcher + gap + sheet + exit row (world-space artboard). */
  h: 1120,
  /** Launcher icon row (matches desktop h-10 + breathing room). */
  launcherSlot: 48,
  gapLauncherSheet: 16,
  header: 56,
  rowCardMinH: 76,
  rowBadgeMinH: 104,
  padOuter: 0,
  padInner: 14,
  gapSection: 12,
  gapRow: 12,
  iconTab: 26,
  iconRow: 34,
  stickerImg: 72,
  tabMinW: 128,
  fsBrand: 26,
  fsTag: 13,
  fsTab: 14,
  fsBody: 15,
  fsSmall: 12,
  fsDistance: 12,
  exitRowH: 40,
} as const;

/** Inner column width (horizontal padding like desktop px-4). */
export const XR_INNER_W = XR_PANEL.w - 32;

/** Scroll viewport: floating sheet body (no outer panel fill — transparent). */
export const XR_CONTENT_H = 880;

/** POI pill width — mirrors desktop ~360px card at max-w. */
export const XR_ROW_W = Math.min(380, XR_INNER_W - 8);

/** Uniform scale fallback (debug override `?xrUiScale=`). */
export const XR_UI_SCALE_DEFAULT = 0.064;
