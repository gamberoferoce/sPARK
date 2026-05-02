import type { World } from "@iwsdk/core";

/**
 * Migliora nitidezza percepita vs UI nativa Horizon (Meta OS):
 * - Il nostro stack è WebGL nel browser; spesso `devicePixelRatio` è 1 sul Quest Browser → canvas “soft”.
 * - WebXR può supersamplare il framebuffer finché non siamo in sessione immersiva.
 *
 * Chiamare dopo `World.create` / `getWorld()`, **prima** di `renderer.xr.setSession(...)`.
 * Quando già in XR, riapplica solo il DPR (il framebuffer scale non è più modificabile).
 */
export function applyXrUiRenderingBoost(world: World): void {
  const r = world.renderer;

  try {
    const raw = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    /* Molti browser XR riportano DPR basso: alziamo il piano minimo (costo GPU). */
    r.setPixelRatio(Math.min(Math.max(raw, 2), 2.75));
  } catch {
    // ignore
  }

  try {
    if (!r.xr.isPresenting) {
      /* Più pixel nel layer XR (Three.js WebXRManager). Tipico range consigliato 1.25–1.75 sul Quest. */
      r.xr.setFramebufferScaleFactor(1.9);
    }
  } catch {
    // ignore
  }
}
