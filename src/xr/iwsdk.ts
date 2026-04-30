import { SessionMode, World } from "@iwsdk/core";
import { Container, Image as UiImage, Text } from "@pmndrs/uikit";

let worldPromise: Promise<World> | null = null;
let stopWorldUi: (() => void) | null = null;

function ensureContainer() {
  let el = document.getElementById("xr-scene") as HTMLDivElement | null;
  if (el) return el;

  el = document.createElement("div");
  el.id = "xr-scene";
  el.style.position = "fixed";
  el.style.inset = "0";
  el.style.zIndex = "5";
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

// DOM overlay input mapping was superseded by world-space UI.

function startWorldSpaceUi(world: World) {
  stopWorldUi?.();

  const rootEl = document.getElementById("root");
  if (rootEl) rootEl.style.display = "none";

  // Root panel (uikit units are pixels-ish; world scale is handled by uikit panel system)
  const uiRoot = new Container({
    width: 420,
    height: 120,
    padding: 16,
    gap: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  });

  // Place panel in world space in front of user.
  uiRoot.position.set(0, 1.35, -1.1);

  let open = false;

  const render = () => {
    uiRoot.clear();

    const launcher = new Container({
      width: 64,
      height: 64,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.45)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      alignItems: "center",
      justifyContent: "center",
      // hover/active styling
      hover: { backgroundColor: "rgba(255,255,255,0.08)" },
      active: { backgroundColor: "rgba(255,255,255,0.12)" },
    });
    launcher.addEventListener("click", () => {
      open = !open;
      render();
    });

    launcher.add(
      new UiImage({
        src: "/icons/tab-cards.svg",
        width: 26,
        height: 26,
        opacity: 0.95,
        color: "white",
      }),
    );
    uiRoot.add(launcher);

    if (!open) return;

    const cardsBtn = new Container({
      width: 140,
      height: 56,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.35)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      hover: { backgroundColor: "rgba(255,255,255,0.08)" },
      active: { backgroundColor: "rgba(255,255,255,0.12)" },
    });
    cardsBtn.add(new UiImage({ src: "/icons/tab-cards.svg", width: 20, height: 20, opacity: 0.95, color: "white" }));
    cardsBtn.add(new Text({ text: "Cards", fontSize: 18, color: "white" }));
    uiRoot.add(cardsBtn);

    const badgesBtn = new Container({
      width: 140,
      height: 56,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.35)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      hover: { backgroundColor: "rgba(255,255,255,0.08)" },
      active: { backgroundColor: "rgba(255,255,255,0.12)" },
    });
    badgesBtn.add(new UiImage({ src: "/icons/tab-badges.png", width: 22, height: 22, opacity: 0.95 }));
    badgesBtn.add(new Text({ text: "Badges", fontSize: 18, color: "white" }));
    uiRoot.add(badgesBtn);
  };

  render();
  world.getPersistentRoot().add(uiRoot);

  let raf = 0;
  let prev = 0;
  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const delta = prev ? t - prev : 16;
    prev = t;
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
    if (rootEl) rootEl.style.display = "";
  };
}

export async function enterAR() {
  if (typeof navigator === "undefined" || !("xr" in navigator)) {
    throw new Error("WebXR is not available in this browser.");
  }
  const w = await getWorld();
  w.launchXR({
    sessionMode: SessionMode.ImmersiveAR,
    features: {
      handTracking: { required: false },
      layers: true,
    },
  });
  // World-space UI (default closed, only launcher visible)
  startWorldSpaceUi(w);
}

export async function exitAR() {
  if (!worldPromise) return;
  const w = await worldPromise;
  stopWorldUi?.();
  stopWorldUi = null;
  w.exitXR();
}

