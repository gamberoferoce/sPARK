import { SessionMode, World } from "@iwsdk/core";
import { Container, Image as UiImage, Text } from "@pmndrs/uikit";
import { Euler, Quaternion, Raycaster, Vector3 } from "three";

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
  // Don't hide the DOM immediately: if the XR permission prompt is up or XR fails,
  // hiding the app makes it look "frozen". We'll hide only once we have a session.
  let domHidden = false;
  const hideDom = () => {
    if (domHidden) return;
    domHidden = true;
    if (rootEl) rootEl.style.display = "none";
  };
  const showDom = () => {
    if (!domHidden) return;
    domHidden = false;
    if (rootEl) rootEl.style.display = "";
  };

  // Root panel (uikit uses pixel-like units; we scale to meters)
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

  // Scale: 420px ≈ 0.42m (1px -> 0.001m)
  uiRoot.scale.setScalar(0.001);

  // World-space placement (reasonable default) and facing user.
  uiRoot.position.set(0, 1.35, -1.2);
  uiRoot.quaternion.setFromEuler(new Euler(0, 0, 0));

  const XR_DEBUG = new URLSearchParams(window.location.search).has("xrDebug");

  // Default in XR: nothing visible until double-pinch.
  // In debug mode, keep it visible so we can validate placement/scale first.
  uiRoot.visible = XR_DEBUG ? true : false;

  type Kind = "cards" | "badge";
  let launcherOpen = false;
  let selected: Kind = "cards";

  // References for hit targets
  let launcherBtn: Container | null = null;
  let cardsBtn: Container | null = null;
  let badgesBtn: Container | null = null;

  // Build UI tree for current state
  const buildUi = () => {
    uiRoot.clear();

    launcherBtn = new Container({
      width: 64,
      height: 64,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.45)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      alignItems: "center",
      justifyContent: "center",
    });
    launcherBtn.userData = { action: "launcher" };
    launcherBtn.add(
      new UiImage({
        src: selected === "badge" ? "/icons/tab-badges.png" : "/icons/tab-cards.svg",
        width: selected === "badge" ? 30 : 26,
        height: selected === "badge" ? 30 : 26,
        opacity: 0.95,
        color: "white",
      }),
    );
    uiRoot.add(launcherBtn);

    if (!launcherOpen) return;

    cardsBtn = new Container({
      width: 140,
      height: 56,
      borderRadius: 999,
      backgroundColor: selected === "cards" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.35)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    });
    cardsBtn.userData = { action: "cards" };
    cardsBtn.add(new UiImage({ src: "/icons/tab-cards.svg", width: 20, height: 20, opacity: 0.95, color: "white" }));
    cardsBtn.add(new Text({ text: "Cards", fontSize: 18, color: "white" }));
    uiRoot.add(cardsBtn);

    badgesBtn = new Container({
      width: 140,
      height: 56,
      borderRadius: 999,
      backgroundColor: selected === "badge" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.35)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    });
    badgesBtn.userData = { action: "badge" };
    badgesBtn.add(new UiImage({ src: "/icons/tab-badges.png", width: 22, height: 22, opacity: 0.95 }));
    badgesBtn.add(new Text({ text: "Badges", fontSize: 18, color: "white" }));
    uiRoot.add(badgesBtn);
  };

  buildUi();

  world.getPersistentRoot().add(uiRoot);

  // --- XR interaction: raycast + pinch + double pinch toggle + pinch-drag horizontal to switch kind ---
  const raycaster = new Raycaster();
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const origin = new Vector3();
  const dir = new Vector3();

  let pinchDown = false;
  let pinchStartX = 0;
  let activeAction: null | "launcher" | "cards" | "badge" = null;

  const setVisible = (v: boolean) => {
    uiRoot.visible = v;
    if (!v) launcherOpen = false;
    buildUi();
  };

  const hitTestAction = (): { action: typeof activeAction; localX: number } => {
    // Use right hand if present, else left.
    const s = world.session;
    const refSpace = world.renderer.xr.getReferenceSpace();
    const frame = world.renderer.xr.getFrame();
    if (!s || !refSpace || !frame) return { action: null, localX: 0 };
    const src =
      world.input.getPrimaryInputSource("right") ??
      world.input.getPrimaryInputSource("left") ??
      s.inputSources?.[0];
    if (!src) return { action: null, localX: 0 };
    const pose = frame.getPose(src.targetRaySpace, refSpace);
    if (!pose) return { action: null, localX: 0 };

    origin.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
    dir.set(pose.transform.orientation.x, pose.transform.orientation.y, pose.transform.orientation.z).normalize();
    // Correct direction: -Z in ray space.
    tmpQuat.set(
      pose.transform.orientation.x,
      pose.transform.orientation.y,
      pose.transform.orientation.z,
      pose.transform.orientation.w,
    );
    dir.set(0, 0, -1).applyQuaternion(tmpQuat).normalize();

    raycaster.ray.origin.copy(origin);
    raycaster.ray.direction.copy(dir);
    raycaster.far = 10;

    // Intersect only uiRoot subtree
    const hits = raycaster.intersectObject(uiRoot, true);
    if (!hits.length) return { action: null, localX: 0 };
    const hit = hits[0]!;

    // Climb to a Container with userData.action
    let o: any = hit.object;
    while (o && !o.userData?.action) o = o.parent;
    const action = (o?.userData?.action as typeof activeAction) ?? null;

    const localPoint = uiRoot.worldToLocal(hit.point.clone());
    // Convert to meters so gesture thresholds are stable even if UI scale changes.
    const localX_m = localPoint.x * uiRoot.scale.x;
    return { action, localX: localX_m };
  };

  const onSelectStart = () => {
    pinchDown = true;

    if (!uiRoot.visible) return; // if hidden, double pinch handles toggle
    const { action, localX } = hitTestAction();
    activeAction = action;
    pinchStartX = localX;
  };

  const onSelectEnd = () => {
    const wasHidden = !uiRoot.visible;

    if (wasHidden) {
      // First pinch shows the launcher/UI immediately.
      // (Pinch is surfaced as WebXR `select*` out of the box on Quest hands.)
      setVisible(true);
      pinchDown = false;
      return;
    }

    // If visible: treat as click if no big horizontal drag; else open selected.
    const { localX } = hitTestAction();
    const dx = localX - pinchStartX;

    if (Math.abs(dx) > 0.08) {
      // drag selects kind
      selected = dx > 0 ? "badge" : "cards";
    }

    if (activeAction === "launcher") {
      launcherOpen = !launcherOpen;
      buildUi();
    } else if (activeAction === "cards") {
      selected = "cards";
      launcherOpen = true;
      buildUi();
      // TODO: open Cards sheet content in XR panel
    } else if (activeAction === "badge") {
      selected = "badge";
      launcherOpen = true;
      buildUi();
      // TODO: open Badges sheet content in XR panel
    } else {
      // pinch on empty space closes dropdown
      launcherOpen = false;
      buildUi();
    }

    activeAction = null;
    pinchDown = false;
  };

  const ensureSessionHandlers = () => {
    const s = world.session ?? world.renderer?.xr?.getSession?.() ?? undefined;
    if (!s) return;
    hideDom();
    s.addEventListener("selectstart", onSelectStart);
    s.addEventListener("selectend", onSelectEnd);
    // Some runtimes/devices fire `select` more reliably than `selectend` for hand pinch.
    // Treat it as a "release" event for the double-pinch toggle and clicks.
    s.addEventListener("select", onSelectEnd as EventListener);
    s.addEventListener("end", () => {
      setVisible(false);
      showDom();
    });
  };

  const handlersTimer = window.setInterval(() => {
    if (world.session || world.renderer?.xr?.getSession?.()) {
      ensureSessionHandlers();
      window.clearInterval(handlersTimer);
    }
  }, 200);

  // Also listen to three's XR manager session start, which is the most reliable signal.
  try {
    // `three` types this as a strongly-typed event; we only need a best-effort hook here.
    (world.renderer as any)?.xr?.addEventListener?.("sessionstart", ensureSessionHandlers as any);
  } catch {
    // ignore
  }

  let raf = 0;
  let prev = 0;
  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const delta = prev ? t - prev : 16;
    prev = t;

    // Keep panel roughly facing the user but in world space (not head-locked).
    if (uiRoot.visible) {
      const cam = world.camera;
      const lookAt = cam.getWorldPosition(tmpPos);
      uiRoot.lookAt(lookAt);
    }

    // While pinching, update selected kind from horizontal drag.
    if (pinchDown && uiRoot.visible) {
      const { localX } = hitTestAction();
      const dx = localX - pinchStartX;
      if (Math.abs(dx) > 0.08) {
        selected = dx > 0 ? "badge" : "cards";
        buildUi();
      }
    }

    uiRoot.update(delta);
  };
  raf = requestAnimationFrame(tick);

  stopWorldUi = () => {
    cancelAnimationFrame(raf);
    window.clearInterval(handlersTimer);
    const s = world.session;
    s?.removeEventListener("selectstart", onSelectStart);
    s?.removeEventListener("selectend", onSelectEnd);
    s?.removeEventListener("select", onSelectEnd as EventListener);
    try {
      uiRoot.dispose();
    } catch {
      // ignore
    }
    uiRoot.removeFromParent();
    showDom();
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

