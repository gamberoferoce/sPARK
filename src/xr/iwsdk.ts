import { ReferenceSpaceType, SessionMode, World } from "@iwsdk/core";
import { Quaternion, Vector3 } from "three";

let worldPromise: Promise<World> | null = null;
let stopDomPointer: (() => void) | null = null;

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

function startDomHandPointer(world: World) {
  stopDomPointer?.();

  const q = new Quaternion();
  const origin = new Vector3();
  const dir = new Vector3();
  const point = new Vector3();

  let raf = 0;
  let pinching = false;
  let lastX = 0;
  let lastY = 0;
  let lastMoveAt = 0;

  const onSelectStart = () => {
    pinching = true;
    const target = document.elementFromPoint(lastX, lastY) as Element | null;
    target?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: lastX, clientY: lastY, button: 0 }),
    );
  };
  const onSelectEnd = () => {
    pinching = false;
    const target = document.elementFromPoint(lastX, lastY) as Element | null;
    target?.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: lastX, clientY: lastY, button: 0 }),
    );
    target?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, clientX: lastX, clientY: lastY, button: 0 }),
    );
  };

  const attachSession = () => {
    const s = world.session;
    if (!s) return false;
    s.addEventListener("selectstart", onSelectStart);
    s.addEventListener("selectend", onSelectEnd);
    return true;
  };

  // Might be set shortly after launchXR; poll until it exists.
  const ensureListeners = () => {
    if (attachSession()) return;
    const t = window.setInterval(() => {
      if (attachSession()) window.clearInterval(t);
    }, 200);
  };
  ensureListeners();

  const tick = () => {
    raf = requestAnimationFrame(tick);

    const s = world.session;
    if (!s) return;
    const refSpace = world.renderer.xr.getReferenceSpace();
    if (!refSpace) return;

    const src =
      world.input.getPrimaryInputSource("right") ??
      world.input.getPrimaryInputSource("left") ??
      s.inputSources?.[0];
    if (!src) return;

    const frame = world.renderer.xr.getFrame();
    if (!frame) return;

    const pose = frame.getPose(src.targetRaySpace, refSpace);
    if (!pose) return;

    const t = pose.transform;
    origin.set(t.position.x, t.position.y, t.position.z);
    q.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
    dir.set(0, 0, -1).applyQuaternion(q).normalize();
    point.copy(origin).addScaledVector(dir, 1.0); // 1m along ray

    // Project into screen space using current XR camera.
    point.project(world.camera);
    const x = Math.round(((point.x + 1) / 2) * window.innerWidth);
    const y = Math.round(((1 - (point.y + 1) / 2)) * window.innerHeight);

    // clamp
    const cx = Math.max(0, Math.min(window.innerWidth - 1, x));
    const cy = Math.max(0, Math.min(window.innerHeight - 1, y));

    const now = performance.now();
    const prevX = lastX;
    const prevY = lastY;
    const moved = cx !== prevX || cy !== prevY;
    lastX = cx;
    lastY = cy;

    if (moved) {
      lastMoveAt = now;
      const target = document.elementFromPoint(lastX, lastY) as Element | null;
      target?.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, cancelable: false, clientX: lastX, clientY: lastY }),
      );
    }

    // Scroll with pinch+drag (vertical delta -> wheel)
    if (pinching && moved) {
      const dy = lastY - prevY;
      // Approx: if motion is fast, amplify.
      const speed = Math.min(3, Math.max(1, (now - lastMoveAt) / 16));
      const target = document.elementFromPoint(lastX, lastY) as Element | null;
      target?.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: lastX, clientY: lastY, deltaY: dy * speed }),
      );
    }
  };

  raf = requestAnimationFrame(tick);

  stopDomPointer = () => {
    cancelAnimationFrame(raf);
    const s = world.session;
    s?.removeEventListener("selectstart", onSelectStart);
    s?.removeEventListener("selectend", onSelectEnd);
    pinching = false;
  };
}

export async function enterAR() {
  if (typeof navigator === "undefined" || !("xr" in navigator)) {
    throw new Error("WebXR is not available in this browser.");
  }
  const w = await getWorld();
  w.launchXR({
    sessionMode: SessionMode.ImmersiveAR,
    referenceSpace: { type: ReferenceSpaceType.LocalFloor },
    features: {
      handTracking: { required: false },
      layers: true,
    },
  });
  startDomHandPointer(w);
}

export async function exitAR() {
  if (!worldPromise) return;
  const w = await worldPromise;
  stopDomPointer?.();
  stopDomPointer = null;
  w.exitXR();
}

