/**
 * sPARK XR — Spark panel design tokens (UIKit layout px).
 *
 * The panel is a fixed “artboard”: no percentages against the WebGL canvas.
 * Uniform `scale` on the root Container maps this design into world space.
 *
 * **Qualità / nitidezza (pmndrs/uikit):** `pixelSize` è il metro-per-pixel-logico (default libreria = 0.01).
 * Valori più bassi = più pixel effettivi per la stessa dimensione fisica → testo MSDF e pannelli meno “sgranati”.
 * Si compensa aumentando `XR_UI_SCALE_DEFAULT` così `pixelSize × scale` (ingombro nel mondo) resta coerente.
 *
 * `XR_PIXEL_SIZE`: più basso = più dettaglio (meno sgranato). Accoppiato a `XR_UI_SCALE_DEFAULT`.
 */
/** Più basso = più texel per metro (meno “mosaico”). ×scale mantiene lo stesso ingombro (~0.00128 m/px layout). */
export const XR_PIXEL_SIZE = 0.0016 as const;
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
} as const;

/** Inner column width (horizontal padding like desktop px-4). */
export const XR_INNER_W = XR_PANEL.w - 32;

/** Scroll viewport: floating sheet body (no outer panel fill — transparent). */
export const XR_CONTENT_H = 880;

/** POI pill width — mirrors desktop ~360px card at max-w. */
export const XR_ROW_W = Math.min(380, XR_INNER_W - 8);

/**
 * Scala mondo sul root UI (override `?xrUiScale=`).
 * Prodotto pixelSize×scale ≈ 0.00128 m per px layout (stesso footprint di 0.0025×0.512).
 */
export const XR_UI_SCALE_DEFAULT = 0.8;
