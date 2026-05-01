import { SessionMode, World } from "@iwsdk/core";

let worldPromise: Promise<World> | null = null;
let stopWorldUi: (() => void) | null = null;

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

// DOM overlay input mapping was superseded by DOM overlay XR mode.

export async function enterAR() {
  if (typeof navigator === "undefined" || !("xr" in navigator)) {
    throw new Error("WebXR is not available in this browser.");
  }
  const w = await getWorld();

  // DOM Overlay mode:
  // - Keep the existing React DOM UI exactly as on desktop.
  // - Request an immersive-ar session that allows DOM overlay rendering.
  const xr = (navigator as any).xr as XRSystem;
  const initBase: XRSessionInit = {
    // If DOM overlay isn't actually granted, the browser may hide the entire page in immersive mode
    // and you'll see "nothing". Make it REQUIRED so we fail fast with a visible error instead.
    requiredFeatures: ["dom-overlay"],
    optionalFeatures: ["hand-tracking", "layers"],
    // DOM overlay root must be an Element.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    domOverlay: { root: document.body } as any,
  };

  // Prefer local-floor if available; fall back to local/viewer.
  let session: XRSession;
  try {
    session = await xr.requestSession("immersive-ar", { ...initBase, requiredFeatures: ["local-floor"] });
  } catch {
    try {
      session = await xr.requestSession("immersive-ar", { ...initBase, requiredFeatures: ["local"] });
    } catch {
      session = await xr.requestSession("immersive-ar", initBase);
    }
  }

  // IWSDK World uses a three WebXRManager under the hood.
  // Set the session directly so IWSDK keeps its render loop.
  await w.renderer.xr.setSession(session);
  w.session = session;

  // Ensure any world-space UI is stopped; we want the desktop DOM UX in AR.
  stopWorldUi?.();
  stopWorldUi = null;

  session.addEventListener("end", () => {
    if (w.session === session) w.session = undefined;
  });
}

export async function exitAR() {
  if (!worldPromise) return;
  const w = await worldPromise;
  stopWorldUi?.();
  stopWorldUi = null;
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

