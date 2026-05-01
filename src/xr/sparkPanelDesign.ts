/**
 * sPARK XR — Spark panel design tokens (UIKit layout px).
 *
 * The panel is a fixed “artboard”: no percentages against the WebGL canvas.
 * Only uniform `scale` on the root Container maps this design into world space.
 */
export const XR_PANEL = {
  w: 900,
  h: 1060,
  header: 56,
  rowCardMinH: 72,
  rowBadgeMinH: 100,
  padOuter: 18,
  padInner: 12,
  gapSection: 12,
  gapRow: 12,
  iconTab: 26,
  iconRow: 34,
  stickerImg: 72,
  tabMinW: 128,
  fsBrand: 26,
  fsTag: 13,
  fsTab: 15,
  fsBody: 16,
  fsSmall: 13,
} as const;

/** Inner column width inside padded `uiRoot`. */
export const XR_INNER_W = XR_PANEL.w - 2 * XR_PANEL.padOuter;

/** Scroll viewport height below header + section gap. */
export const XR_CONTENT_H = XR_PANEL.h - 2 * XR_PANEL.padOuter - XR_PANEL.header - XR_PANEL.gapSection;

/** List row width inside the padded content region. */
export const XR_ROW_W = XR_INNER_W - 2 * XR_PANEL.padInner;
