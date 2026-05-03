/**
 * Replica runtime della curva `ui-drift-float` (see `src/styles/ui-drift-float.css`)
 * usando i transform esposti da `@pmndrs/uikit` (`transformTranslateY`, `transformRotateZ`, scale).
 */

import type { Component } from "@pmndrs/uikit";

export const DRIFT_FLOAT_PERIOD_MS = 3800;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Campiona la stessa forma della keyframe CSS (0% / 33% / 66% / 100%). */
export function sampleUiDriftFloat(t01: number) {
  const t = ((t01 % 1) + 1) % 1;
  if (t <= 0.33) {
    const w = t / 0.33;
    const e = easeInOutCubic(w);
    return {
      translateY: lerp(0, -6, e),
      rotateZ: lerp(-1.25, 1.75, e),
      scale: lerp(1, 1.025, e),
    };
  }
  if (t <= 0.66) {
    const w = (t - 0.33) / 0.33;
    const e = easeInOutCubic(w);
    return {
      translateY: lerp(-6, -3, e),
      rotateZ: lerp(1.75, 0.25, e),
      scale: lerp(1.025, 1.008, e),
    };
  }
  const w = (t - 0.66) / 0.34;
  const e = easeInOutCubic(w);
  return {
    translateY: lerp(-3, 0, e),
    rotateZ: lerp(0.25, -1.25, e),
    scale: lerp(1.008, 1, e),
  };
}

export function applyUiDriftFloat(
  c: Component,
  timeMs: number,
  phaseMs: number,
  reducedMotion: boolean,
) {
  if (reducedMotion) {
    c.setProperties({
      transformTranslateY: 0,
      transformRotateZ: 0,
      transformScaleX: 1,
      transformScaleY: 1,
    });
    return;
  }
  const u = ((timeMs + phaseMs) % DRIFT_FLOAT_PERIOD_MS) / DRIFT_FLOAT_PERIOD_MS;
  const { translateY, rotateZ, scale } = sampleUiDriftFloat(u);
  c.setProperties({
    transformTranslateY: translateY,
    transformRotateZ: rotateZ,
    transformScaleX: scale,
    transformScaleY: scale,
  });
}
