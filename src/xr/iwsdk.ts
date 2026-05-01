import { SessionMode, World } from "@iwsdk/core";
import { Container, Image as UiImage, Text } from "@pmndrs/uikit";
import { DoubleSide, Euler, Mesh, MeshBasicMaterial, Quaternion, Raycaster, SphereGeometry, Vector3 } from "three";

let worldPromise: Promise<World> | null = null;
let stopWorldUi: (() => void) | null = null;

function parseFloatParam(name: string, fallback: number) {
  try {
    const qs = new URLSearchParams(window.location.search);
    let v = qs.get(name);
    if (!v) {
      try {
        const raw = sessionStorage.getItem("xrFlags");
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === "object" && parsed !== null && name in (parsed as any)) {
            v = String((parsed as any)[name]);
          }
        }
      } catch {
        // ignore
      }
    }
    if (!v) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

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

const STICKERS = [
  "/stickers/sticker-1.png",
  "/stickers/sticker-2.png",
  "/stickers/sticker-3.png",
  "/stickers/sticker-4.png",
  "/stickers/sticker-5.png",
] as const;

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stickerForRideId(id: string) {
  const idx = hashString(id) % STICKERS.length;
  return STICKERS[idx]!;
}

type XRKind = "cards" | "badge";

type Poi = {
  id: string;
  nome: string;
  categoria?: string;
  coda_minuti?: number;
};

function startWorldSpaceDesktopLikeUi(world: World) {
  stopWorldUi?.();

  const debug = flagParam("xrDbg");
  const dbgUiScale = parseFloatParam("xrUiScale", NaN);
  const dbgUiZ = parseFloatParam("xrUiZ", NaN);

  const rootEl = document.getElementById("root");
  const hideDom = () => {
    if (rootEl) rootEl.style.display = "none";
  };
  const showDom = () => {
    if (rootEl) rootEl.style.display = "";
  };

  const uiRoot = new Container({
    width: 900,
    height: 1060,
    padding: 18,
    gap: 12,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
  });

  // Empirical Quest scale: big enough, not face-locked.
  uiRoot.scale.setScalar(Number.isFinite(dbgUiScale) ? dbgUiScale : 0.0016);
  uiRoot.position.set(0, 1.42, Number.isFinite(dbgUiZ) ? dbgUiZ : -1.25);
  uiRoot.quaternion.setFromEuler(new Euler(0, 0, 0));
  uiRoot.visible = true;

  let selected: XRKind = "cards";
  let pois: Poi[] = [];
  let unlocked = new Set<string>();
  try {
    const raw = localStorage.getItem("badgesSbloccati");
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) unlocked = new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    // ignore
  }

  const titleRow = new Container({
    width: 900,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  });
  const titleLeft = new Container({
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
  });
  titleLeft.add(new Text({ text: "sPARK", fontSize: 26, color: "white" }));
  titleLeft.add(new Text({ text: "XR", fontSize: 14, color: "rgba(255,255,255,0.72)" }));

  const dot = new Container({
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,50,50,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  });

  const tabs = new Container({
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  });

  const content = new Container({
    width: 900,
    height: 980,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
    flexDirection: "column",
    gap: 10,
    overflow: "scroll",
  });

  const mkTab = (kind: XRKind) => {
    const isActive = selected === kind;
    const btn = new Container({
      width: 156,
      height: 44,
      borderRadius: 999,
      backgroundColor: isActive ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.25)",
      borderWidth: 1,
      borderColor: isActive ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    });
    btn.userData = { action: kind };
    btn.add(
      new UiImage({
        src: kind === "badge" ? "/icons/tab-badges.png" : "/icons/tab-cards.svg",
        width: kind === "badge" ? 20 : 18,
        height: kind === "badge" ? 20 : 18,
        opacity: 0.95,
        color: "white",
      }),
    );
    btn.add(new Text({ text: kind === "badge" ? "Badges" : "Cards", fontSize: 16, color: "white" }));
    return btn;
  };

  const build = () => {
    uiRoot.clear();
    titleRow.clear();
    tabs.clear();
    content.clear();

    tabs.add(dot);
    tabs.add(mkTab("cards"));
    tabs.add(mkTab("badge"));

    titleRow.add(titleLeft);
    titleRow.add(tabs);
    uiRoot.add(titleRow);

    if (selected === "cards") {
      if (pois.length === 0) {
        content.add(
          new Text({
            text: "Loading POIs…",
            fontSize: 16,
            color: "rgba(255,255,255,0.85)",
          }),
        );
      }
      for (const p of pois) {
        const row = new Container({
          width: 876,
          height: 70,
          borderRadius: 18,
          backgroundColor: "rgba(0,0,0,0.35)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        });
        const left = new Container({ flexDirection: "row", alignItems: "center", gap: 12 });

        const iconWrap = new Container({
          width: 44,
          height: 44,
          borderRadius: 999,
          backgroundColor: "rgba(0,0,0,0.55)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.28)",
          alignItems: "center",
          justifyContent: "center",
        });

        const cat = p.categoria ?? "";
        const iconSrc =
          cat === "attrazione"
            ? "/icons/ride.svg"
            : cat === "ristoro"
              ? "/icons/food.svg"
              : cat === "wc"
                ? "/icons/wc.svg"
                : cat === "asciugatura"
                  ? "/icons/dryer.svg"
                  : "/icons/tab-cards.svg";

        iconWrap.add(new UiImage({ src: iconSrc, width: 22, height: 22, opacity: 0.95, color: "white" }));
        left.add(iconWrap);
        left.add(new Text({ text: p.nome, fontSize: 16, color: "white" }));

        const right = new Container({ flexDirection: "row", alignItems: "center", gap: 10 });
        const w = typeof p.coda_minuti === "number" ? p.coda_minuti : null;
        if (w != null && w >= 0) {
          const badge = new Container({
            height: 34,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.14)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            alignItems: "center",
            justifyContent: "center",
          });
          badge.add(new Text({ text: `${Math.round(w)} min`, fontSize: 14, color: "white" }));
          right.add(badge);
        } else if (w === -1) {
          const badge = new Container({
            height: 34,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            alignItems: "center",
            justifyContent: "center",
          });
          badge.add(new Text({ text: "Closed", fontSize: 14, color: "rgba(255,255,255,0.85)" }));
          right.add(badge);
        }

        row.add(left);
        row.add(right);
        content.add(row);
      }
    } else {
      const rides = pois.filter((p) => p.categoria === "attrazione");
      if (rides.length === 0) {
        content.add(
          new Text({
            text: pois.length === 0 ? "Loading attractions…" : "No attractions found in poi.json.",
            fontSize: 16,
            color: "rgba(255,255,255,0.85)",
          }),
        );
      }
      for (const p of rides) {
        const unlockedNow = unlocked.has(p.id);
        const item = new Container({
          width: 876,
          height: 104,
          borderRadius: 18,
          backgroundColor: "rgba(0,0,0,0.35)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 14,
        });

        const imgWrap = new Container({
          width: 90,
          height: 80,
          borderRadius: 16,
          backgroundColor: "rgba(0,0,0,0.25)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          alignItems: "center",
          justifyContent: "center",
        });
        imgWrap.add(new UiImage({ src: stickerForRideId(p.id), width: 76, height: 76, opacity: unlockedNow ? 0.92 : 0.32 }));

        const textCol = new Container({ flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 6 });
        textCol.add(new Text({ text: p.nome, fontSize: 16, color: "white" }));
        textCol.add(
          new Text({
            text: unlockedNow ? "Unlocked" : "Locked",
            fontSize: 14,
            color: unlockedNow ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.60)",
          }),
        );

        item.add(imgWrap);
        item.add(textCol);
        content.add(item);
      }
    }

    uiRoot.add(content);
  };

  const setDot = (state: "down" | "up") => {
    dot.setProperties({
      backgroundColor: state === "down" ? "rgba(35, 210, 120, 0.95)" : "rgba(255,50,50,0.95)",
    });
  };

  world.getPersistentRoot().add(uiRoot);
  build();

  // Debug helpers (Quest-friendly): tiny spheres at multiple depths + HTML overlay stats.
  const dbgMeshes: Mesh[] = [];
  if (debug) {
    const root = world.getPersistentRoot();
    const mk = (color: number, x: number, y: number, z: number, r: number) => {
      const m = new Mesh(new SphereGeometry(r, 18, 18), new MeshBasicMaterial({ color, depthWrite: false, transparent: true, opacity: 0.95, side: DoubleSide }));
      m.position.set(x, y, z);
      root.add(m);
      dbgMeshes.push(m);
    };
    mk(0xff3333, -0.35, 1.35, -0.35, 0.06); // near
    mk(0xffdd33, 0.0, 1.35, -1.25, 0.06); // medium
    mk(0x33aaff, 0.35, 1.35, -3.0, 0.06); // far
  }

  const overlayEl = debug ? ensureHtmlOverlay() : null;

  // Load poi.json like desktop
  void fetch("/poi.json")
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) {
        pois = (data as Poi[]).filter((x) => x && typeof x.id === "string" && typeof x.nome === "string");
        build();
      }
    })
    .catch(() => {
      pois = [];
      build();
    });

  const raycaster = new Raycaster();
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const origin = new Vector3();
  const dir = new Vector3();

  let pinchDown = false;
  let pinchStartX = 0;
  let activeAction: null | XRKind = null;

  const hitTest = (): { action: null | XRKind; localX: number } => {
    const s = world.session ?? world.renderer?.xr?.getSession?.() ?? undefined;
    const refSpace = world.renderer?.xr?.getReferenceSpace?.();
    const frame = world.renderer?.xr?.getFrame?.();
    if (!s || !refSpace || !frame) return { action: null, localX: 0 };
    const src =
      world.input.getPrimaryInputSource("right") ??
      world.input.getPrimaryInputSource("left") ??
      s.inputSources?.[0];
    if (!src) return { action: null, localX: 0 };
    const pose = frame.getPose(src.targetRaySpace, refSpace);
    if (!pose) return { action: null, localX: 0 };

    origin.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
    tmpQuat.set(
      pose.transform.orientation.x,
      pose.transform.orientation.y,
      pose.transform.orientation.z,
      pose.transform.orientation.w,
    );
    dir.set(0, 0, -1).applyQuaternion(tmpQuat).normalize();
    raycaster.ray.origin.copy(origin);
    raycaster.ray.direction.copy(dir);
    raycaster.far = 12;

    const hits = raycaster.intersectObject(uiRoot, true);
    if (!hits.length) return { action: null, localX: 0 };
    const hit = hits[0]!;
    let o: any = hit.object;
    while (o && !o.userData?.action) o = o.parent;
    const action = (o?.userData?.action as XRKind | undefined) ?? null;
    const localPoint = uiRoot.worldToLocal(hit.point.clone());
    const localX_m = localPoint.x * uiRoot.scale.x;
    return { action, localX: localX_m };
  };

  const onSelectStart = () => {
    setDot("down");
    pinchDown = true;
    const { action, localX } = hitTest();
    activeAction = action;
    pinchStartX = localX;
  };

  const onSelectEnd = () => {
    setDot("up");
    const { localX } = hitTest();
    const dx = localX - pinchStartX;
    if (Math.abs(dx) > 0.10) {
      selected = dx > 0 ? "badge" : "cards";
      build();
    } else if (activeAction) {
      selected = activeAction;
      build();
    }
    activeAction = null;
    pinchDown = false;
  };

  // Attach pinch/select handlers once the session exists.
  const attachHandlers = () => {
    const s = world.session ?? world.renderer?.xr?.getSession?.() ?? undefined;
    if (!s) return false;
    hideDom();
    setDot("up");
    s.addEventListener("selectstart", onSelectStart);
    s.addEventListener("selectend", onSelectEnd);
    // Some runtimes fire `select` more reliably than `selectend` for hand pinch.
    s.addEventListener("select", onSelectEnd as EventListener);
    s.addEventListener("end", () => {
      showDom();
      setDot("up");
    });
    return true;
  };

  const handlersTimer = window.setInterval(() => {
    if (attachHandlers()) window.clearInterval(handlersTimer);
  }, 200);

  let raf = 0;
  let prev = 0;
  let frames = 0;
  let hitsUi = 0;
  let hitsDbg = 0;
  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const delta = prev ? t - prev : 16;
    prev = t;
    // Face the user (but keep world-space position).
    uiRoot.lookAt(world.camera.getWorldPosition(tmpPos));
    if (pinchDown) {
      const { localX } = hitTest();
      const dx = localX - pinchStartX;
      if (Math.abs(dx) > 0.10) {
        const next = dx > 0 ? "badge" : "cards";
        if (next !== selected) {
          selected = next;
          build();
        }
      }
    }
    uiRoot.update(delta);

    frames++;
    if (debug && overlayEl && frames % 15 === 0) {
      // Quick ray diagnostics (doesn't depend on UIKit raycasting internals).
      const s = world.session ?? world.renderer?.xr?.getSession?.() ?? undefined;
      const refSpace = world.renderer?.xr?.getReferenceSpace?.();
      const frame = world.renderer?.xr?.getFrame?.();
      const src =
        s &&
        (world.input.getPrimaryInputSource("right") ??
          world.input.getPrimaryInputSource("left") ??
          s.inputSources?.[0]);
      let rayOk = false;
      if (s && refSpace && frame && src) {
        const pose = frame.getPose(src.targetRaySpace, refSpace);
        rayOk = !!pose;
        if (pose) {
          origin.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
          tmpQuat.set(
            pose.transform.orientation.x,
            pose.transform.orientation.y,
            pose.transform.orientation.z,
            pose.transform.orientation.w,
          );
          dir.set(0, 0, -1).applyQuaternion(tmpQuat).normalize();
          raycaster.ray.origin.copy(origin);
          raycaster.ray.direction.copy(dir);
          raycaster.far = 25;
          hitsUi = raycaster.intersectObject(uiRoot, true).length;
          hitsDbg = dbgMeshes.reduce((acc, m) => acc + raycaster.intersectObject(m, false).length, 0);
        }
      }

      overlayEl.textContent =
        `XR dbg\n` +
        `session: ${s ? "yes" : "no"} | rayPose: ${rayOk ? "yes" : "no"}\n` +
        `hits(uiRoot): ${hitsUi} | hits(debug sphere): ${hitsDbg}\n` +
        `pois: ${pois.length}\n` +
        `ui.scale: ${uiRoot.scale.x.toFixed(6)} ui.z: ${uiRoot.position.z.toFixed(3)}\n` +
        `tips: add ?xrDbg&xrUiScale=0.004&xrUiZ=-0.9`;
    }
  };
  raf = requestAnimationFrame(tick);

  stopWorldUi = () => {
    cancelAnimationFrame(raf);
    window.clearInterval(handlersTimer);
    const s = world.session ?? world.renderer?.xr?.getSession?.() ?? undefined;
    s?.removeEventListener("selectstart", onSelectStart);
    s?.removeEventListener("selectend", onSelectEnd);
    s?.removeEventListener("select", onSelectEnd as EventListener);
    try {
      uiRoot.dispose();
    } catch {
      // ignore
    }
    uiRoot.removeFromParent();
    for (const m of dbgMeshes) {
      try {
        m.geometry.dispose();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m.material as any)?.dispose?.();
      } catch {
        // ignore
      }
      m.removeFromParent();
    }
    removeHtmlOverlay();
    showDom();
  };
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
      if (key === "xrDbg" || key.startsWith("xrUi")) xrPairs.push([key, value]);
    });
    if (xrPairs.length) {
      const obj: Record<string, string> = {};
      for (const [k, v] of xrPairs) obj[k] = v;
      sessionStorage.setItem("xrFlags", JSON.stringify(obj));
    }
  } catch {
    // ignore
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

  // Desktop-like UI (no web background) in world-space.
  startWorldSpaceDesktopLikeUi(w);
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

