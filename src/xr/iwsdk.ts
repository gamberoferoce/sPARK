import {
  SessionMode,
  World,
  buildSessionInit,
  launchXR,
  normalizeReferenceSpec,
  resolveReferenceSpaceType,
} from "@iwsdk/core";

import { mountDesktopLikeSparkUi } from "./sparkUiMount";

let worldPromise: Promise<World> | null = null;
let stopWorldUi: (() => void) | null = null;

/** Set when we fall back to UIKit so HUD can explain (Quest Browser often omits DOM Overlay — see Meta forums / MDN). */
let xrDomOverlayFallbackHint: string | null = null;

function flagParam(name: string) {
  try {
    const qs = new URLSearchParams(window.location.search);
    if (qs.has(name)) return true;
    try {
      const raw = sessionStorage.getItem("xrFlags");
      if (!raw) return false;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || parsed === null) return false;
      return name in (parsed as any);
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

function ensureHtmlOverlay() {
  let el = document.getElementById("xr-html-debug") as HTMLDivElement | null;
  if (el) return el;
  el = document.createElement("div");
  el.id = "xr-html-debug";
  el.style.position = "fixed";
  el.style.left = "12px";
  el.style.top = "12px";
  el.style.zIndex = "999999";
  el.style.maxWidth = "min(92vw, 520px)";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "14px";
  el.style.background = "rgba(0,0,0,0.65)";
  el.style.border = "1px solid rgba(255,255,255,0.18)";
  el.style.color = "rgba(255,255,255,0.92)";
  el.style.font = "12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial";
  el.style.pointerEvents = "none";
  document.body.appendChild(el);
  return el;
}

function removeHtmlOverlay() {
  const el = document.getElementById("xr-html-debug");
  if (el) el.remove();
}

function ensureContainer() {
  let el = document.getElementById("xr-scene") as HTMLDivElement | null;
  if (el) return el;

  el = document.createElement("div");
  el.id = "xr-scene";
  el.style.position = "fixed";
  el.style.inset = "0";
  // IMPORTANT (DOM overlay): keep the XR canvas behind the React DOM,
  // otherwise the WebGL canvas can cover the whole UI and you'll see "nothing".
  el.style.zIndex = "0";
  el.style.pointerEvents = "none"; // keep React DOM interactive (DOM overlay-style UX)
  document.body.appendChild(el);
  return el;
}

async function endActiveSessionIfAny(world: World) {
  const s = world.session;
  if (!s) return;
  try {
    await s.end();
  } catch {
    // ignore
  }
}

/**
 * Per https://immersive-web.github.io/dom-overlays/#xr-session-interface — if optional `dom-overlay`
 * was dropped, `domOverlayState` is null (not the React/IWSDK UIKit panel; IWSDK docs are about uikit).
 */
function isDomOverlayActive(session: XRSession): boolean {
  const st = (session as unknown as { domOverlayState: { type: string } | null }).domOverlayState;
  return st != null && typeof st.type === "string" && st.type.length > 0;
}

/** Same binding as IWSDK `launchXR` after `requestSession`, plus DOM-overlay cleanup hooks. */
async function attachXRSession(world: World, session: XRSession) {
  const onNativeSessionEnd = () => {
    session.removeEventListener("end", onNativeSessionEnd);
    world.session = undefined;
    document.getElementById("root")?.classList.remove("xr-dom-overlay-host");
  };

  session.addEventListener("end", onNativeSessionEnd);
  try {
    const refSpec = normalizeReferenceSpec(world.xrDefaults?.referenceSpace);
    const resolvedType = await resolveReferenceSpaceType(
      session,
      refSpec.type,
      refSpec.required ? [] : refSpec.fallbackOrder,
    );
    world.renderer.xr.getDepthSensingMesh = function () {
      return null;
    };
    world.renderer.xr.setReferenceSpaceType(resolvedType);
    await world.renderer.xr.setSession(session);
    world.session = session;
  } catch (err) {
    console.error("[XR] Failed to acquire reference space:", err);
    session.removeEventListener("end", onNativeSessionEnd);
    document.getElementById("root")?.classList.remove("xr-dom-overlay-host");
    try {
      await session.end();
    } catch {
      // ignore
    }
    throw err;
  }
}

async function getWorld() {
  if (worldPromise) return await worldPromise;
  const container = ensureContainer();
  worldPromise = World.create(container, {
    xr: {
      sessionMode: SessionMode.ImmersiveAR,
      offer: "none",
    },
    // Keep features minimal; we only need passthrough + hands.
    features: { locomotion: false, grabbing: false },
  });
  return await worldPromise;
}

function startWorldSpaceDesktopLikeUi(world: World) {
  stopWorldUi?.();
  stopWorldUi = mountDesktopLikeSparkUi(world, {
    onExit: () => {
      void exitAR();
    },
    xrDomOverlayFallbackHint,
  });
}


export async function enterAR() {
  if (typeof navigator === "undefined" || !("xr" in navigator)) {
    throw new Error("WebXR is not available in this browser.");
  }

  // XR Session Navigation limitation:
  // Quest Browser navigation happens WITHOUT query strings, so flags like `?xrDbg` won't survive.
  // Persist XR debug toggles into sessionStorage so repeated enters keep working.
  try {
    const qs = new URLSearchParams(window.location.search);
    const xrPairs: Array<[string, string]> = [];
    qs.forEach((value, key) => {
      if (key === "xrDbg" || key.startsWith("xr")) {
        xrPairs.push([key, value]);
      }
    });
    if (xrPairs.length) {
      let prev: Record<string, string> = {};
      try {
        const rawPrev = sessionStorage.getItem("xrFlags");
        if (rawPrev) {
          const parsed = JSON.parse(rawPrev) as unknown;
          if (parsed && typeof parsed === "object" && parsed !== null) prev = parsed as Record<string, string>;
        }
      } catch {
        // ignore
      }
      const merged = { ...prev };
      for (const [k, v] of xrPairs) merged[k] = v;
      sessionStorage.setItem("xrFlags", JSON.stringify(merged));
    }
  } catch {
    // ignore
  }

  const w = await getWorld();

  if (w.session) {
    console.warn("[XR] Session already active");
    return;
  }

  const overlayRoot = document.getElementById("root");
  if (!overlayRoot) {
    throw new Error("Missing #root element for DOM overlay.");
  }

  const xrFeatures = {
    handTracking: { required: false } as const,
    layers: true as const,
  };

  // Skip DOM-overlay attempt (e.g. known Quest Browser limitation — see Meta community “DOM overlay Quest”).
  if (flagParam("xrSkipDomOverlay")) {
    xrDomOverlayFallbackHint =
      "xrSkipDomOverlay: uso solo pannello UIKit (DOM overlay non richiesto).\n";
    await endActiveSessionIfAny(w);
    launchXR(w, {
      sessionMode: SessionMode.ImmersiveAR,
      features: xrFeatures,
    });
    startWorldSpaceDesktopLikeUi(w);
    return;
  }

  /*
   * DOM Overlay is WebXR module spec, not IWSDK-specific: https://immersive-web.github.io/dom-overlays/
   * Meta Quest Browser on-device is repeatedly reported NOT to implement it while Chrome/emulator may — so
   * domOverlayState === null + UIKit fallback is often a platform gap, not this file being “wrong”.
   * MDN: limited availability / experimental.
   */
  const domRequired = flagParam("xrDomRequired");
  // Minimal optional set: bounded-floor can fail negotiation on some AR runtimes; local-floor is enough for IWSDK resolveReferenceSpaceType fallbacks.
  const leanDomInit = (): XRSessionInit => ({
    ...(domRequired ? { requiredFeatures: ["dom-overlay"] as string[] } : {}),
    optionalFeatures: domRequired ? (["local-floor"] as string[]) : (["dom-overlay", "local-floor"] as string[]),
    domOverlay: { root: overlayRoot },
  });
  const richDomInit = (): XRSessionInit => {
    const baseInit = buildSessionInit({ features: xrFeatures });
    const optionalFeatures = Array.from(new Set([...(baseInit.optionalFeatures ?? []), "dom-overlay"]));
    return {
      ...baseInit,
      optionalFeatures,
      domOverlay: { root: overlayRoot },
    } as XRSessionInit;
  };

  try {
    let domSession: XRSession;
    if (domRequired) {
      domSession = await navigator.xr!.requestSession(SessionMode.ImmersiveAR, leanDomInit());
    } else {
      try {
        domSession = await navigator.xr!.requestSession(SessionMode.ImmersiveAR, leanDomInit());
      } catch (leanErr) {
        console.warn("[XR] Lean DOM-overlay session failed, retrying with full optional features:", leanErr);
        domSession = await navigator.xr!.requestSession(SessionMode.ImmersiveAR, richDomInit());
      }
    }
    overlayRoot.classList.add("xr-dom-overlay-host");
    await attachXRSession(w, domSession);

    console.info("[XR] domOverlayState after attach:", (domSession as unknown as { domOverlayState?: unknown }).domOverlayState);

    if (!isDomOverlayActive(domSession)) {
      // Session starts but overlay was omitted → previously we returned with zero UI (no UIKit).
      console.warn("[XR] Session started without DOM Overlay; ending session and using UIKit panel.");
      overlayRoot.classList.remove("xr-dom-overlay-host");
      try {
        await domSession.end();
      } catch {
        // ignore
      }
      throw new Error("dom-overlay inactive");
    }

    xrDomOverlayFallbackHint = null;
    const hud = ensureHtmlOverlay();
    hud.textContent =
      "AR: DOM overlay attivo (UI React)\nSe non vedi i pulsanti, usa Exit AR e riprova.\n";

    return;
  } catch (e) {
    overlayRoot.classList.remove("xr-dom-overlay-host");
    xrDomOverlayFallbackHint =
      "DOM Overlay non attivo → UI 3D (UIKit). Su Meta Quest Browser il modulo è spesso assente sul device (community Meta); MDN: supporto limitato. Non è un bug IWSDK.\n";
    console.warn("[XR] DOM Overlay path failed; falling back to UIKit world panel:", e);
  }

  await endActiveSessionIfAny(w);

  launchXR(w, {
    sessionMode: SessionMode.ImmersiveAR,
    features: xrFeatures,
  });
  startWorldSpaceDesktopLikeUi(w);
}

export async function exitAR() {
  removeHtmlOverlay();
  if (!worldPromise) return;
  const w = await worldPromise;
  stopWorldUi?.();
  stopWorldUi = null;
  xrDomOverlayFallbackHint = null;
  const s = w.session ?? w.renderer?.xr?.getSession?.() ?? null;
  if (s) {
    try {
      await s.end();
    } catch {
      // ignore
    }
    w.session = undefined;
    return;
  }
  w.exitXR();
}

