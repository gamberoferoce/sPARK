import { SessionMode, World } from "@iwsdk/core";
import { Container, Text } from "@pmndrs/uikit";
import { Euler, Vector3 } from "three";

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

function startWorldSpaceDebugUi(world: World) {
  stopWorldUi?.();

  const uiRoot = new Container({
    width: 680,
    height: 220,
    padding: 22,
    gap: 10,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  });

  // Scale up aggressively for Quest testing (40x).
  uiRoot.scale.setScalar(0.04);
  uiRoot.position.set(0, 1.45, -1.2);
  uiRoot.quaternion.setFromEuler(new Euler(0, 0, 0));
  uiRoot.visible = true;

  uiRoot.add(
    new Text({
      text: "XR OK",
      fontSize: 64,
      color: "white",
    }),
  );
  uiRoot.add(
    new Text({
      text: "If you can read this, world-space UI rendering works.",
      fontSize: 18,
      color: "rgba(255,255,255,0.92)",
    }),
  );
  uiRoot.add(
    new Text({
      text: "Next: re-enable launcher + ray + pinch.",
      fontSize: 16,
      color: "rgba(255,255,255,0.75)",
    }),
  );

  world.getPersistentRoot().add(uiRoot);

  let raf = 0;
  const tmp = new Vector3();
  let prev = 0;
  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const delta = prev ? t - prev : 16;
    prev = t;
    // Face the user (but keep world-space position).
    uiRoot.lookAt(world.camera.getWorldPosition(tmp));
    uiRoot.update(delta);
  };
  raf = requestAnimationFrame(tick);

  stopWorldUi = () => {
    cancelAnimationFrame(raf);
    try {
      uiRoot.dispose();
    } catch {
      // ignore
    }
    uiRoot.removeFromParent();
  };
}

export async function enterAR() {
  if (typeof navigator === "undefined" || !("xr" in navigator)) {
    throw new Error("WebXR is not available in this browser.");
  }
  const w = await getWorld();

  // Back to basics: let IWSDK start the XR session normally.
  // This avoids DOM overlay edge-cases and gives us a deterministic world-space "XR OK" panel.
  w.launchXR({
    sessionMode: SessionMode.ImmersiveAR,
    features: {
      handTracking: { required: false },
      layers: true,
    },
  });

  // Always show something visible in XR first.
  startWorldSpaceDebugUi(w);
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

