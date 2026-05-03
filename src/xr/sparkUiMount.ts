import { Container, Image as UiImage, Text } from "@pmndrs/uikit";
import type { Component as UiComponent } from "@pmndrs/uikit";
import type { World } from "@iwsdk/core";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Euler,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Raycaster,
  SphereGeometry,
  Vector3,
} from "three";

import type { ProfiloUtente } from "@/components/Onboarding";
import { calcolaDistanza } from "@/core/algorithm.js";
import { PARCO } from "@/core/config.js";
import { filterPoisByProfile } from "@/lib/poiFilter";
import { applySimulatedServiceQueues, SERVICE_QUEUE_FREEZE_ATTR_CLOSED_RATIO } from "@/lib/simulatedServiceQueues";
import type { Poi } from "@/types/poi";

import {
  bodyTrackingEm,
  CARD_BG,
  CIRCLE_BG,
  CLOSED_BADGE_BG,
  CLOSED_BADGE_FG,
  CLOSED_BADGE_RING,
  ICON_RING,
  LAUNCHER_BG,
  LAUNCHER_BORDER,
  LINE,
  TAB_ACTIVE_BG,
  TAB_ACTIVE_RING,
  TAB_TEXT_ACTIVE,
  TAB_TEXT_INACTIVE,
  TEXT_ZINC_500,
  TEXT_ZINC_600,
  trackingWideEm,
  waitBadgeColors,
} from "./flatUiTokens";
import {
  XR_CONTENT_H,
  XR_INNER_W,
  XR_PANEL,
  XR_PIXEL_SIZE,
  XR_ROW_W,
  XR_UI_SCALE_DEFAULT,
} from "./sparkPanelDesign";
import { applyUiDriftFloat } from "./xrUiDrift";
import { applyXrUiRenderingBoost } from "./xrRendererQuality";

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
  return STICKERS[hashString(id) % STICKERS.length]!;
}

/** Desktop uses CSS `invert(1)` on black SVGs; UIKit moltiplica la texture → serve SVG bianco. */
function xrIconSvg(iconsPath: string): string {
  if (!iconsPath.startsWith("/icons/") || !iconsPath.endsWith(".svg")) return iconsPath;
  const base = iconsPath.slice("/icons/".length);
  return `/icons/xr/${base}`;
}

function formatDistanza(metri: number) {
  if (!Number.isFinite(metri)) return "—";
  if (metri < 1000) return `${Math.round(metri)} m`;
  return `${(metri / 1000).toFixed(1)} km`;
}

function parseYmd(ymd: string) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d);
}

function parseHm(hm: string) {
  const m = String(hm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function isParcoOpenNow(now = new Date()) {
  const start = parseYmd(PARCO.stagione.inizio);
  const end = parseYmd(PARCO.stagione.fine);
  if (!start || !end) return true;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < start || today > end) return false;
  const openMin = parseHm(PARCO.orario_apertura) ?? 0;
  const closeMin = parseHm(PARCO.orario_chiusura_default) ?? 24 * 60;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= openMin && nowMin < closeMin;
}

function loadProfilo(): ProfiloUtente | null {
  try {
    const raw = localStorage.getItem("profiloUtente");
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    if (typeof o.altezza_cm !== "number" || !Array.isArray(o.intensita) || !Array.isArray(o.diete)) return null;
    return p as ProfiloUtente;
  } catch {
    return null;
  }
}

function loadBellMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem("sparkBellById");
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persistBellMap(b: Record<string, boolean>) {
  try {
    localStorage.setItem("sparkBellById", JSON.stringify(b));
  } catch {
    // ignore
  }
}

function loadLastPos(): Poi["posizione"] {
  try {
    const raw = localStorage.getItem("lastUserPos");
    if (!raw) return { lat: 45.4631, lng: 9.1894 };
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return { lat: 45.4631, lng: 9.1894 };
    const o = p as Record<string, unknown>;
    if (typeof o.lat === "number" && typeof o.lng === "number") return { lat: o.lat, lng: o.lng };
  } catch {
    // ignore
  }
  return { lat: 45.4631, lng: 9.1894 };
}

type XRKind = "cards" | "badge";
type PoiCat = "attrazione" | "ristoro" | "servizi";
type BadgeSub = "galleria" | "scansiona";

type XrUi =
  | { k: "launcher" }
  | { k: "poiCat"; cat: PoiCat }
  | { k: "badgeSub"; sub: BadgeSub }
  | { k: "bell"; id: string }
  | { k: "nav"; id: string }
  | { k: "scanStart" };

function readXrUi(o: Object3D | null): XrUi | null {
  let cur: Object3D | null = o;
  while (cur) {
    const u = (cur as unknown as { userData?: { xrUi?: XrUi } }).userData?.xrUi;
    if (u) return u;
    cur = cur.parent;
  }
  return null;
}

function flagParam(name: string) {
  try {
    const qs = new URLSearchParams(window.location.search);
    if (qs.has(name)) return true;
    const raw = sessionStorage.getItem("xrFlags");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || parsed === null) return false;
    return name in (parsed as object);
  } catch {
    return false;
  }
}

function parseFloatParam(name: string, fallback: number) {
  try {
    const qs = new URLSearchParams(window.location.search);
    let v = qs.get(name);
    if (!v) {
      const raw = sessionStorage.getItem("xrFlags");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && name in parsed) v = String(parsed[name]);
      }
    }
    if (!v) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export type MountSparkUiOpts = {
  xrDomOverlayFallbackHint?: string | null;
};

export function mountDesktopLikeSparkUi(world: World, opts: MountSparkUiOpts): () => void {
  /* DPR dopo session start (framebuffer già fissato in enterAR). */
  applyXrUiRenderingBoost(world);

  const debug = flagParam("xrDbg");
  const dbgUiScale = parseFloatParam("xrUiScale", NaN);
  const dbgUiY = parseFloatParam("xrUiY", NaN);
  const dbgUiZ = parseFloatParam("xrUiZ", NaN);
  const uiProbe = flagParam("xrUiProbe");
  const followCam = !flagParam("xrWorldUi");

  const rootEl = document.getElementById("root");
  const hideDom = () => {
    if (rootEl) rootEl.style.display = "none";
  };
  const showDom = () => {
    if (rootEl) rootEl.style.display = "";
  };

  let launcherKind: XRKind = (() => {
    try {
      const v = localStorage.getItem("launcherKind");
      return v === "badge" ? "badge" : "cards";
    } catch {
      return "cards";
    }
  })();
  let sheetOpen = false;
  let poiCat: PoiCat = "attrazione";
  let badgeSub: BadgeSub = "galleria";
  let scanNotice = false;

  let profilo = loadProfilo();
  let bellById = loadBellMap();
  let userPos = loadLastPos();
  let freezeServiceQueues = !isParcoOpenNow();
  /** Last successful Queue-Times fetch — mirrors App `lastQueueTimesOkRef` for season fallback window. */
  let lastQueueTimesOk = 0;
  let rawPois: Poi[] = [];

  const reducedMotion =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const driftNodes: Array<{ node: UiComponent; phase: number }> = [];

  const hudEl = document.getElementById("xr-html-debug") ?? createHudEl();

  function createHudEl() {
    const el = document.createElement("div");
    el.id = "xr-html-debug";
    el.style.cssText =
      "position:fixed;left:12px;top:12px;z-index:999999;max-width:min(92vw,520px);padding:10px 12px;border-radius:14px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.18);color:rgba(255,255,255,0.92);font:400 12px/1.35 Nunito,system-ui,sans-serif;letter-spacing:0.02em;pointer-events:none";
    document.body.appendChild(el);
    return el;
  }

  const stackH = XR_PANEL.launcherSlot + XR_PANEL.gapLauncherSheet + XR_CONTENT_H;

  const uiRoot = new Container({
    width: XR_PANEL.w,
    height: stackH,
    pixelSize: XR_PIXEL_SIZE,
    padding: 0,
    gap: XR_PANEL.gapLauncherSheet,
    backgroundColor: "rgba(0,0,0,0)",
    borderWidth: uiProbe ? 2 : 0,
    borderColor: uiProbe ? "rgba(255,60,60,0.6)" : "rgba(0,0,0,0)",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    depthTest: false,
    depthWrite: false,
    renderOrder: 1000,
    fontFamily: "Nunito",
    fontWeight: "normal",
  });

  uiRoot.scale.setScalar(Number.isFinite(dbgUiScale) ? dbgUiScale : XR_UI_SCALE_DEFAULT);
  /* Camera locale: Y negativo = più in basso nel campo visivo (override ?xrUiY=). Z ~75 cm davanti (?xrUiZ=). */
  const uiYDefault = -0.32;
  uiRoot.position.set(0, Number.isFinite(dbgUiY) ? dbgUiY : uiYDefault, Number.isFinite(dbgUiZ) ? dbgUiZ : -0.75);
  uiRoot.quaternion.setFromEuler(new Euler(0, 0, 0));
  uiRoot.visible = true;

  const launcherSlot = new Container({
    width: XR_PANEL.w,
    height: XR_PANEL.launcherSlot,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  });

  const sheetSlot = new Container({
    width: XR_INNER_W,
    height: XR_CONTENT_H,
    flexShrink: 0,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "scroll",
    backgroundColor: "rgba(0,0,0,0)",
    gap: 10,
  });

  uiRoot.add(launcherSlot);
  uiRoot.add(sheetSlot);

  function poiFiltered(): Poi[] {
    if (!profilo) return [];
    return filterPoisByProfile(rawPois, profilo);
  }

  function poiSortedForTab(): Array<{ p: Poi; m: number; bell: boolean; coda: number }> {
    const list = poiFiltered().filter((p) => {
      if (poiCat === "servizi") {
        return p.categoria === "servizi" || p.categoria === "wc" || p.categoria === "asciugatura";
      }
      return p.categoria === poiCat;
    });
    const rows = list.map((p) => ({
      p,
      m: calcolaDistanza(userPos, p.posizione),
      bell: bellById[p.id] === true,
      coda: Number(p.coda_minuti),
    }));
    rows.sort((a, b) => {
      if (a.bell !== b.bell) return a.bell ? -1 : 1;
      const ac = Number.isFinite(a.coda) ? a.coda : 9999;
      const bc = Number.isFinite(b.coda) ? b.coda : 9999;
      if (ac !== bc) return ac - bc;
      if (a.m !== b.m) return a.m - b.m;
      return a.p.nome.localeCompare(b.p.nome, "it");
    });
    return rows;
  }

  function mkLauncherButton() {
    const btn = new Container({
      width: 40,
      height: 40,
      flexShrink: 0,
      borderRadius: 999,
      backgroundColor: LAUNCHER_BG,
      borderWidth: 1,
      borderColor: LAUNCHER_BORDER,
      alignItems: "center",
      justifyContent: "center",
    });
    (btn as unknown as Object3D).userData = { xrUi: { k: "launcher" } satisfies XrUi };
    const src = launcherKind === "badge" ? "/icons/tab-badges.png" : xrIconSvg("/icons/tab-cards.svg");
    btn.add(
      new UiImage({
        src,
        width: launcherKind === "badge" ? 24 : 22,
        height: launcherKind === "badge" ? 24 : 22,
        opacity: 0.98,
        color: "white",
        depthTest: false,
        depthWrite: false,
      }),
    );
    return btn;
  }

  function mkPoiCategoryTabs() {
    const row = new Container({
      width: XR_INNER_W,
      height: 44,
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    });
    const tabs: { cat: PoiCat; label: string }[] = [
      { cat: "attrazione", label: "Rides" },
      { cat: "ristoro", label: "Food" },
      { cat: "servizi", label: "Services" },
    ];
    for (const t of tabs) {
      const on = poiCat === t.cat;
      const cell = new Container({
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        height: 40,
        borderRadius: 999,
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: on ? TAB_ACTIVE_BG : "rgba(0,0,0,0)",
        borderWidth: on ? 1 : 0,
        borderColor: on ? TAB_ACTIVE_RING : "rgba(0,0,0,0)",
        alignItems: "center",
        justifyContent: "center",
      });
      (cell as unknown as Object3D).userData = { xrUi: { k: "poiCat", cat: t.cat } satisfies XrUi };
      cell.add(
        new Text({
          text: t.label,
          fontSize: XR_PANEL.fsTab,
          fontWeight: "normal",
          letterSpacing: trackingWideEm(XR_PANEL.fsTab),
          color: on ? TAB_TEXT_ACTIVE : TAB_TEXT_INACTIVE,
          textAlign: "center",
        }),
      );
      row.add(cell);
    }
    return row;
  }

  function mkBadgeSubTabs() {
    const row = new Container({
      width: XR_INNER_W,
      height: 44,
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    });
    const tabs: { sub: BadgeSub; label: string }[] = [
      { sub: "galleria", label: "Gallery" },
      { sub: "scansiona", label: "Scan" },
    ];
    for (const t of tabs) {
      const on = badgeSub === t.sub;
      const cell = new Container({
        minWidth: 120,
        height: 40,
        borderRadius: 999,
        paddingLeft: 16,
        paddingRight: 16,
        backgroundColor: on ? TAB_ACTIVE_BG : "rgba(0,0,0,0)",
        borderWidth: on ? 1 : 0,
        borderColor: on ? TAB_ACTIVE_RING : "rgba(0,0,0,0)",
        alignItems: "center",
        justifyContent: "center",
      });
      (cell as unknown as Object3D).userData = { xrUi: { k: "badgeSub", sub: t.sub } satisfies XrUi };
      cell.add(
        new Text({
          text: t.label,
          fontSize: XR_PANEL.fsTab,
          fontWeight: "normal",
          letterSpacing: trackingWideEm(XR_PANEL.fsTab),
          color: on ? TAB_TEXT_ACTIVE : TAB_TEXT_INACTIVE,
        }),
      );
      row.add(cell);
    }
    return row;
  }

  function mkPoiRow(p: Poi, m: number) {
    const coda = Number(p.coda_minuti);
    const hasCoda = Number.isFinite(coda);
    const bellOn = bellById[p.id] === true;
    const isService =
      p.categoria === "ristoro" || p.categoria === "wc" || p.categoria === "asciugatura";
    const isClosed = isService ? freezeServiceQueues || coda === -1 : coda === -1;
    const showWait =
      (poiCat === "attrazione" || poiCat === "ristoro" || (poiCat === "servizi" && (p.categoria === "wc" || p.categoria === "asciugatura"))) &&
      hasCoda &&
      coda >= 0 &&
      !(isService && freezeServiceQueues);

    const row = new Container({
      width: XR_ROW_W,
      minHeight: XR_PANEL.rowCardMinH,
      flexShrink: 0,
      borderRadius: 999,
      backgroundColor: CARD_BG,
      borderWidth: 1,
      borderColor: LINE,
      paddingLeft: 14,
      paddingRight: 40,
      paddingTop: 10,
      paddingBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: XR_PANEL.gapRow,
    });

    const left = new Container({
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    });

    const iconWrap = new Container({
      width: 40,
      height: 40,
      flexShrink: 0,
      borderRadius: 999,
      backgroundColor: CIRCLE_BG,
      borderWidth: 1,
      borderColor: ICON_RING,
      alignItems: "center",
      justifyContent: "center",
    });
    const iconSrc = xrIconSvg(
      p.categoria === "attrazione"
        ? "/icons/ride.svg"
        : p.categoria === "ristoro"
          ? "/icons/food.svg"
          : p.categoria === "wc"
            ? "/icons/wc.svg"
            : p.categoria === "asciugatura"
              ? "/icons/dryer.svg"
              : "/icons/tab-cards.svg",
    );
    iconWrap.add(
      new UiImage({
        src: iconSrc,
        width: p.categoria === "attrazione" ? 26 : 24,
        height: p.categoria === "attrazione" ? 26 : 24,
        opacity: 0.95,
        color: "white",
        depthTest: false,
        depthWrite: false,
      }),
    );

    const textCol = new Container({
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: "column",
      gap: 4,
      alignItems: "flex-start",
    });
    textCol.add(
      new Text({
        text: p.nome,
        fontSize: XR_PANEL.fsBody,
        fontWeight: "normal",
        letterSpacing: bodyTrackingEm(XR_PANEL.fsBody),
        color: "white",
        maxWidth: XR_ROW_W - 200,
        wordBreak: "break-word",
      }),
    );
    const distRow = new Container({
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    });
    distRow.add(
      new Text({
        text: "📍",
        fontSize: XR_PANEL.fsDistance,
        color: "white",
      }),
    );
    distRow.add(
      new Text({
        text: formatDistanza(m),
        fontSize: XR_PANEL.fsDistance,
        fontWeight: "normal",
        color: TEXT_ZINC_500,
      }),
    );
    textCol.add(distRow);
    left.add(iconWrap);
    left.add(textCol);

    const right = new Container({ flexShrink: 0, flexDirection: "column", alignItems: "flex-end", gap: 6 });

    if (isClosed) {
      const badge = new Container({
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 999,
        backgroundColor: CLOSED_BADGE_BG,
        borderWidth: 1,
        borderColor: CLOSED_BADGE_RING,
      });
      badge.add(
        new Text({
          text: "Closed",
          fontSize: XR_PANEL.fsSmall,
          fontWeight: "normal",
          color: CLOSED_BADGE_FG,
        }),
      );
      right.add(badge);
    } else if (showWait) {
      const cols = waitBadgeColors(coda);
      const badge = new Container({
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 999,
        backgroundColor: cols.bg,
        borderWidth: 1,
        borderColor: cols.ring,
      });
      badge.add(
        new Text({
          text: `${Math.round(coda)} min`,
          fontSize: XR_PANEL.fsSmall,
          fontWeight: "normal",
          letterSpacing: trackingWideEm(XR_PANEL.fsSmall),
          color: cols.fg,
        }),
      );
      right.add(badge);
    } else {
      right.add(new Text({ text: "—", fontSize: XR_PANEL.fsSmall, color: TEXT_ZINC_600 }));
    }

    const actions = new Container({
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    });

    const bellBtn = new Container({
      width: 36,
      height: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "white",
      backgroundColor: bellOn ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0)",
      alignItems: "center",
      justifyContent: "center",
    });
    (bellBtn as unknown as Object3D).userData = { xrUi: { k: "bell", id: p.id } satisfies XrUi };
    bellBtn.add(
      new Text({
        text: "🔔",
        fontSize: 16,
        color: "white",
        opacity: bellOn ? 1 : 0.7,
      }),
    );

    const navBtn = new Container({
      width: 36,
      height: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "white",
      backgroundColor: "rgba(0,0,0,0)",
      alignItems: "center",
      justifyContent: "center",
    });
    (navBtn as unknown as Object3D).userData = { xrUi: { k: "nav", id: p.id } satisfies XrUi };
    navBtn.add(
      new Text({
        text: "↗",
        fontSize: 18,
        color: "white",
      }),
    );

    actions.add(bellBtn);
    actions.add(navBtn);

    row.add(left);
    const rightStack = new Container({
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    });
    rightStack.add(right);
    rightStack.add(actions);
    row.add(rightStack);

    return row;
  }

  function build() {
    driftNodes.length = 0;
    profilo = loadProfilo();
    bellById = loadBellMap();
    userPos = loadLastPos();
    try {
      localStorage.setItem("launcherKind", launcherKind);
    } catch {
      // ignore
    }

    launcherSlot.clear();
    launcherSlot.add(mkLauncherButton());

    sheetSlot.clear();

    if (!sheetOpen) {
      sheetSlot.add(
        new Text({
          text: "Tap the icon to open Rides / Badges",
          fontSize: XR_PANEL.fsSmall,
          fontWeight: "normal",
          color: TEXT_ZINC_500,
          textAlign: "center",
        }),
      );
      return;
    }

    if (!profilo) {
      sheetSlot.add(
        new Text({
          text: "Finish onboarding on your phone first — profile not found.",
          fontSize: XR_PANEL.fsBody,
          color: "rgba(251,113,133,0.95)",
          textAlign: "center",
        }),
      );
      return;
    }

    if (launcherKind === "cards") {
      sheetSlot.add(mkPoiCategoryTabs());
      sheetSlot.add(
        new Container({
          height: 10,
          flexShrink: 0,
        }),
      );

      const sorted = poiSortedForTab();
      if (sorted.length === 0) {
        sheetSlot.add(
          new Text({
            text: "No items in this category.",
            fontSize: XR_PANEL.fsBody,
            fontWeight: "normal",
            color: TEXT_ZINC_500,
            textAlign: "center",
          }),
        );
        return;
      }
      for (const x of sorted) {
        sheetSlot.add(mkPoiRow(x.p, x.m));
      }
      return;
    }

    /* badges */
    sheetSlot.add(mkBadgeSubTabs());
    sheetSlot.add(new Container({ height: 8, flexShrink: 0 }));

    const rides = rawPois.filter((p) => p.categoria === "attrazione" && p.badge);
    const sbloccati = (() => {
      try {
        const raw = localStorage.getItem("badgesSbloccati");
        const arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) return 0;
        return rides.filter((p) => arr.includes(p.id)).length;
      } catch {
        return 0;
      }
    })();

    if (badgeSub === "galleria") {
      const grid = new Container({
        width: XR_INNER_W,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 10,
      });
      const cellW = (XR_INNER_W - 10) / 2;
      for (const a of rides) {
        let unlocked = false;
        try {
          const raw = localStorage.getItem("badgesSbloccati");
          const arr = raw ? JSON.parse(raw) : [];
          unlocked = Array.isArray(arr) && arr.includes(a.id);
        } catch {
          unlocked = false;
        }
        const cell = new Container({
          width: cellW,
          minHeight: 120,
          borderRadius: 16,
          padding: 10,
          backgroundColor: "rgba(9,9,11,0.6)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.1)",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        });
        const stickerImg = new UiImage({
          src: stickerForRideId(a.id),
          width: XR_PANEL.stickerImg,
          height: XR_PANEL.stickerImg,
          opacity: unlocked ? 0.9 : 0.35,
          depthTest: false,
          depthWrite: false,
        });
        driftNodes.push({ node: stickerImg, phase: Math.random() * 3800 });
        cell.add(stickerImg);
        cell.add(
          new Text({
            text: a.nome,
            fontSize: XR_PANEL.fsSmall,
            color: "rgba(244,244,245,0.95)",
            textAlign: "center",
            maxWidth: cellW - 8,
            wordBreak: "break-word",
          }),
        );
        grid.add(cell);
      }
      sheetSlot.add(grid);
        sheetSlot.add(
          new Text({
            text: `${sbloccati}/${rides.length} badges unlocked`,
            fontSize: XR_PANEL.fsSmall,
            fontWeight: "normal",
            color: TEXT_ZINC_500,
            textAlign: "center",
          }),
        );
      return;
    }

    /* scan */
    const wrap = new Container({
      width: XR_INNER_W,
      minHeight: 280,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(0,0,0,0)",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: 16,
    });
    if (!scanNotice) {
      const start = new Container({
        paddingLeft: 22,
        paddingRight: 22,
        paddingTop: 12,
        paddingBottom: 12,
        borderRadius: 999,
        backgroundColor: "rgba(24,24,27,0.82)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
      });
      (start as unknown as Object3D).userData = { xrUi: { k: "scanStart" } satisfies XrUi };
      start.add(new Text({ text: "Start scanning", fontSize: XR_PANEL.fsBody, color: "white" }));
      wrap.add(start);
    } else {
      wrap.add(
        new Text({
          text: "Camera scanning runs in flat mode.\nExit AR, then use Scan on your phone.",
          fontSize: XR_PANEL.fsBody,
          color: "rgba(228,228,231,0.95)",
          textAlign: "center",
        }),
      );
    }
    sheetSlot.add(wrap);
  }

  function applySeasonParcoIfStale() {
    if (Date.now() - lastQueueTimesOk < 10 * 60 * 1000) return;
    const next = isParcoOpenNow() === false;
    if (next !== freezeServiceQueues) {
      freezeServiceQueues = next;
      rawPois = applySimulatedServiceQueues(rawPois, freezeServiceQueues);
      build();
    }
  }

  async function fetchQueueTimes() {
    const normalizeName = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ");

    const normalizeRideName = (s: string) => {
      const cleaned = String(s).replace(/^virtual\s*line:\s*/i, "").replace(/^virtualline:\s*/i, "");
      return normalizeName(cleaned);
    };

    try {
      const base = import.meta.env.DEV
        ? "/queue-times"
        : "https://queue-times-proxy.giuliafanasca.workers.dev/api/queue-times";
      const res = await fetch(`${base}/parks/${PARCO.queue_times_park_id}/queue_times.json`);
      if (!res.ok) return;

      type QtRide = { name?: string; is_open?: boolean; wait_time?: number };
      type QtLand = { rides?: QtRide[] };
      const payload = (await res.json()) as { lands?: QtLand[] };
      const lands = Array.isArray(payload.lands) ? payload.lands : [];
      const rides: QtRide[] = [];
      for (const l of lands) {
        const rs = Array.isArray(l?.rides) ? l.rides : [];
        rides.push(...rs);
      }
      if (rides.length === 0) return;

      lastQueueTimesOk = Date.now();

      const poiByNameKey = new Map<string, string>();
      for (const p of rawPois) {
        if (!p?.id || typeof p.nome !== "string") continue;
        poiByNameKey.set(normalizeName(p.nome), p.id);
      }

      let attrazioniQt = 0;
      let attrazioniChiuseQt = 0;
      for (const r of rides) {
        const name = typeof r?.name === "string" ? r.name : "";
        if (!name) continue;
        const poiId = poiByNameKey.get(normalizeRideName(name));
        if (!poiId) continue;
        const poi = rawPois.find((x) => x.id === poiId);
        if (!poi || poi.categoria !== "attrazione") continue;
        attrazioniQt++;
        if (r.is_open === false) attrazioniChiuseQt++;
      }
      freezeServiceQueues =
        attrazioniQt > 0 &&
        attrazioniChiuseQt / attrazioniQt >= SERVICE_QUEUE_FREEZE_ATTR_CLOSED_RATIO;

      const updates = new Map<string, number>();
      for (const r of rides) {
        const name = typeof r?.name === "string" ? r.name : "";
        if (!name) continue;
        const poiId = poiByNameKey.get(normalizeRideName(name));
        if (!poiId) continue;

        if (r.is_open === false) {
          updates.set(poiId, -1);
          continue;
        }
        if (r.is_open !== true) continue;

        const wait = typeof r.wait_time === "number" ? r.wait_time : null;
        if (wait == null || !Number.isFinite(wait)) continue;
        updates.set(poiId, Math.max(0, Math.round(wait)));
      }

      if (updates.size > 0) {
        rawPois = rawPois.map((p) => {
          const next = updates.get(p.id);
          if (next == null) return p;
          return { ...p, coda_minuti: next };
        });
      }

      rawPois = applySimulatedServiceQueues(rawPois, freezeServiceQueues);

      build();
    } catch {
      // ignore
    }
  }

  const seasonParcoTimer = window.setInterval(() => {
    applySeasonParcoIfStale();
  }, 60 * 1000);

  const queueTimesTimer = window.setInterval(() => {
    void fetchQueueTimes();
  }, 5 * 60 * 1000);

  const serviceQueueSimTimer = window.setInterval(() => {
    rawPois = applySimulatedServiceQueues(rawPois, freezeServiceQueues);
    build();
  }, 90 * 1000);

  applySeasonParcoIfStale();
  void fetchQueueTimes();

  void fetch("/poi.json")
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) {
        rawPois = (data as Poi[]).filter((x) => x && typeof x.id === "string");
        for (const p of rawPois) {
          if (bellById[p.id] === undefined) bellById[p.id] = p.notifica_attiva === true;
        }
        persistBellMap(bellById);
        rawPois = applySimulatedServiceQueues(rawPois, freezeServiceQueues);
        build();
        void fetchQueueTimes();
      }
    })
    .catch(() => {
      rawPois = [];
      build();
    });

  if (followCam) world.camera.add(uiRoot);
  else world.getPersistentRoot().add(uiRoot);

  const dbgMeshes: Mesh[] = [];
  if (debug) {
    const root = world.getPersistentRoot();
    const mk = (color: number, x: number, y: number, z: number, r: number) => {
      const m = new Mesh(
        new SphereGeometry(r, 18, 18),
        new MeshBasicMaterial({ color, depthWrite: false, transparent: true, opacity: 0.95, side: DoubleSide }),
      );
      m.position.set(x, y, z);
      root.add(m);
      dbgMeshes.push(m);
    };
    mk(0xff3333, -0.35, 1.35, -0.35, 0.06);
    mk(0xffdd33, 0.0, 1.35, -1.25, 0.06);
    mk(0x33aaff, 0.35, 1.35, -3.0, 0.06);
  }

  const raycaster = new Raycaster();
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const origin = new Vector3();
  const dir = new Vector3();
  /** Ray visivo (hover): separati da hitTest per non sporcare lo stato del raycast logico. */
  const visOrigin = new Vector3();
  const visDir = new Vector3();
  const visRayLen = 4;

  const xrHideRay = flagParam("xrHideRay");
  const rayRoot = world.getPersistentRoot();
  const rayGeom = new BufferGeometry();
  const rayPos = new Float32Array(6);
  rayGeom.setAttribute("position", new BufferAttribute(rayPos, 3));
  const rayLineMat = new LineBasicMaterial({
    color: 0x7dd3fc,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.92,
  });
  const rayLine = new Line(rayGeom, rayLineMat);
  rayLine.frustumCulled = false;
  rayLine.renderOrder = 2000;
  rayLine.visible = false;
  const hitDot = new Mesh(
    new SphereGeometry(0.014, 14, 14),
    new MeshBasicMaterial({
      color: 0x4ade80,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    }),
  );
  hitDot.frustumCulled = false;
  hitDot.renderOrder = 2001;
  hitDot.visible = false;
  const cursorReticle = new Mesh(
    new SphereGeometry(0.012, 12, 12),
    new MeshBasicMaterial({
      color: 0xffaa44,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.92,
    }),
  );
  cursorReticle.frustumCulled = false;
  cursorReticle.renderOrder = 1999;
  cursorReticle.visible = false;
  rayRoot.add(hitDot);
  rayRoot.add(cursorReticle);
  if (!xrHideRay) {
    rayRoot.add(rayLine);
  }

  let pinchDown = false;
  let pinchStartX = 0;
  let pinchStartUi: XrUi | null = null;
  /** Mano che ha iniziato il pinch (per drag launcher + ray nel tick). */
  let pinchRaySource: XRInputSource | null = null;

  /** `false` = cursore 2D sul pannello mosso dal pinch (default). `true` = ray dal controller (`?xrRayPick`). */
  const useRayPick = flagParam("xrRayPick");
  /** Moltiplicatore movimento cursore (pinch). Override: `?xrCursorSens=2.5` */
  const cursorSens = parseFloatParam("xrCursorSens", 2.4);
  /** Pixel layout (0,0) = angolo alto-sinistra del pannello root. */
  let cursorX = XR_PANEL.w / 2;
  let cursorY = XR_PANEL.launcherSlot / 2;
  let pinchStartCursorX = cursorX;
  const lastHandWorld = new Vector3();
  const panelWorldScratch = new Vector3();
  const camToPanelScratch = new Vector3();

  /**
   * Raycast dal controller (target ray).
   * IMPORTANT (Quest / WebXR): `XRFrame` è affidabile per `getPose` soprattutto dentro {@link XRInputSourceEvent}.
   */
  function hitTestRay(
    frameOverride?: XRFrame | null,
    inputSourceOverride?: XRInputSource | null,
  ): { xrUi: XrUi | null; localX: number } {
    const s = world.session ?? world.renderer?.xr?.getSession?.() ?? undefined;
    const refSpace = world.renderer?.xr?.getReferenceSpace?.();
    const frame =
      frameOverride ??
      (typeof world.renderer?.xr?.getFrame === "function" ? world.renderer.xr.getFrame() : null);
    if (!s || !refSpace || !frame) return { xrUi: null, localX: 0 };

    const src =
      inputSourceOverride ??
      (typeof world.input?.getPrimaryInputSource === "function"
        ? world.input.getPrimaryInputSource("right") ?? world.input.getPrimaryInputSource("left")
        : null) ??
      Array.from(s.inputSources ?? [])[0] ??
      null;
    if (!src?.targetRaySpace) return { xrUi: null, localX: 0 };

    const pose = frame.getPose(src.targetRaySpace, refSpace);
    if (!pose) return { xrUi: null, localX: 0 };

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

    Object3D.prototype.updateMatrixWorld.call(uiRoot as Object3D, true);
    const hits = raycaster.intersectObject(uiRoot, true);
    if (!hits.length) return { xrUi: null, localX: 0 };
    const hit = hits[0]!;
    const xrUi = readXrUi(hit.object);
    const localPoint = uiRoot.worldToLocal(hit.point.clone());
    const localX_m = localPoint.x * uiRoot.scale.x;
    return { xrUi, localX: localX_m };
  }

  /** Punto sul piano del pannello (layout px) → world. Assi: centro pannello, +Y su, +X a destra (schermo). */
  function panelPixelToWorld(px: number, py: number, target: Vector3) {
    const sc = uiRoot.scale.x;
    const ps = XR_PIXEL_SIZE;
    const lw = XR_PANEL.w;
    const lh = stackH;
    target.set((px - lw / 2) * ps * sc, ((lh / 2) - py) * ps * sc, 0).applyMatrix4(uiRoot.matrixWorld);
    return target;
  }

  /** Pick da “cursore” 2D: raggio dalla camera attraverso il punto sul pannello (click / hover pinch). */
  function hitTestCursorPickDetail(): {
    xrUi: XrUi | null;
    localX: number;
    hitPoint: Vector3 | null;
  } {
    const cam = world.camera;
    panelPixelToWorld(cursorX, cursorY, panelWorldScratch);
    camToPanelScratch.copy(panelWorldScratch).sub(cam.position);
    if (camToPanelScratch.lengthSq() < 1e-8) return { xrUi: null, localX: 0, hitPoint: null };
    raycaster.ray.origin.copy(cam.position);
    raycaster.ray.direction.copy(camToPanelScratch.normalize());
    raycaster.far = 8;

    Object3D.prototype.updateMatrixWorld.call(uiRoot as Object3D, true);
    const hits = raycaster.intersectObject(uiRoot, true);
    if (!hits.length) return { xrUi: null, localX: 0, hitPoint: null };
    const hit = hits[0]!;
    const xrUi = readXrUi(hit.object);
    const localPoint = uiRoot.worldToLocal(hit.point.clone());
    const localX_m = localPoint.x * uiRoot.scale.x;
    return { xrUi, localX: localX_m, hitPoint: hit.point.clone() };
  }

  function hitTestCursorPick(): { xrUi: XrUi | null; localX: number } {
    const d = hitTestCursorPickDetail();
    return { xrUi: d.xrUi, localX: d.localX };
  }

  function hitTestFull(
    frameOverride?: XRFrame | null,
    inputSourceOverride?: XRInputSource | null,
  ): { xrUi: XrUi | null; localX: number } {
    if (useRayPick) return hitTestRay(frameOverride, inputSourceOverride);
    return hitTestCursorPick();
  }

  function advanceCursorFromHandDelta(frame: XRFrame) {
    const refSpace = world.renderer?.xr?.getReferenceSpace?.();
    if (!refSpace || !pinchRaySource?.targetRaySpace) return;
    const pose = frame.getPose(pinchRaySource.targetRaySpace, refSpace);
    if (!pose) return;
    tmpPos.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
    const deltaWorld = tmpPos.clone().sub(lastHandWorld);
    lastHandWorld.copy(tmpPos);

    const rightW = new Vector3(1, 0, 0).applyQuaternion(uiRoot.quaternion);
    const downW = new Vector3(0, -1, 0).applyQuaternion(uiRoot.quaternion);
    const step = XR_PIXEL_SIZE * uiRoot.scale.x;
    cursorX += (deltaWorld.dot(rightW) / step) * cursorSens;
    cursorY += (deltaWorld.dot(downW) / step) * cursorSens;
    cursorX = Math.max(0, Math.min(XR_PANEL.w, cursorX));
    cursorY = Math.max(0, Math.min(stackH, cursorY));
  }

  /** Linea laser controller OPPURE reticolo cursore pinch sul pannello. */
  function updateXrPointerRayVisual() {
    if (!useRayPick) {
      rayLine.visible = false;
      if (!pinchDown) {
        hitDot.visible = false;
        cursorReticle.visible = false;
        return;
      }
      const det = hitTestCursorPickDetail();
      panelPixelToWorld(cursorX, cursorY, panelWorldScratch);
      cursorReticle.position.copy(panelWorldScratch);
      cursorReticle.visible = true;
      if (det.hitPoint && det.xrUi) {
        hitDot.visible = true;
        hitDot.position.copy(det.hitPoint);
        (hitDot.material as MeshBasicMaterial).color.setHex(0x4ade80);
        (cursorReticle.material as MeshBasicMaterial).color.setHex(0x4ade80);
      } else {
        hitDot.visible = false;
        (cursorReticle.material as MeshBasicMaterial).color.setHex(0xffaa44);
      }
      return;
    }

    if (xrHideRay) return;
    const frame = typeof world.renderer?.xr?.getFrame === "function" ? world.renderer.xr.getFrame() : null;
    const s = world.session ?? world.renderer?.xr?.getSession?.() ?? undefined;
    const refSpace = world.renderer?.xr?.getReferenceSpace?.();
    if (!frame || !s || !refSpace) {
      rayLine.visible = false;
      hitDot.visible = false;
      return;
    }

    const src =
      (pinchDown && pinchRaySource) ||
      (typeof world.input?.getPrimaryInputSource === "function"
        ? world.input.getPrimaryInputSource("right") ?? world.input.getPrimaryInputSource("left")
        : null) ??
      Array.from(s.inputSources ?? []).find((i: XRInputSource) => i.targetRaySpace) ??
      null;
    if (!src?.targetRaySpace) {
      rayLine.visible = false;
      hitDot.visible = false;
      return;
    }

    const pose = frame.getPose(src.targetRaySpace, refSpace);
    if (!pose) {
      rayLine.visible = false;
      hitDot.visible = false;
      return;
    }

    visOrigin.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
    tmpQuat.set(
      pose.transform.orientation.x,
      pose.transform.orientation.y,
      pose.transform.orientation.z,
      pose.transform.orientation.w,
    );
    visDir.set(0, 0, -1).applyQuaternion(tmpQuat).normalize();

    rayPos[0] = visOrigin.x;
    rayPos[1] = visOrigin.y;
    rayPos[2] = visOrigin.z;
    rayPos[3] = visOrigin.x + visDir.x * visRayLen;
    rayPos[4] = visOrigin.y + visDir.y * visRayLen;
    rayPos[5] = visOrigin.z + visDir.z * visRayLen;
    const posAttr = rayGeom.attributes.position as BufferAttribute;
    posAttr.needsUpdate = true;
    rayGeom.computeBoundingSphere();
    rayLine.visible = true;

    raycaster.ray.origin.copy(visOrigin);
    raycaster.ray.direction.copy(visDir);
    raycaster.far = 12;
    Object3D.prototype.updateMatrixWorld.call(uiRoot as Object3D, true);
    const visHits = raycaster.intersectObject(uiRoot, true);
    if (visHits.length > 0) {
      rayLineMat.color.setHex(0x4ade80);
      hitDot.visible = true;
      hitDot.position.copy(visHits[0]!.point);
    } else {
      rayLineMat.color.setHex(0x7dd3fc);
      hitDot.visible = false;
    }
  }

  function handleTap(u: XrUi) {
    switch (u.k) {
      case "poiCat":
        poiCat = u.cat;
        build();
        return;
      case "badgeSub":
        badgeSub = u.sub;
        scanNotice = false;
        build();
        return;
      case "bell": {
        const next = !(bellById[u.id] === true);
        bellById = { ...bellById, [u.id]: next };
        persistBellMap(bellById);
        build();
        return;
      }
      case "nav": {
        const poi = rawPois.find((p) => p.id === u.id);
        hudEl.textContent = poi ? `Map / directions: open flat UI — ${poi.nome}` : "Map: use flat UI";
        return;
      }
      case "scanStart":
        scanNotice = true;
        build();
        return;
      default:
        return;
    }
  }

  const onSelectStart = (ev: Event) => {
    const e = ev as XRInputSourceEvent;
    pinchDown = true;
    pinchRaySource = e.inputSource ?? null;
    const refSpace = world.renderer?.xr?.getReferenceSpace?.();
    if (!useRayPick && refSpace && e.inputSource?.targetRaySpace) {
      cursorX = XR_PANEL.w / 2;
      cursorY = XR_PANEL.launcherSlot / 2;
      pinchStartCursorX = cursorX;
      const pose = e.frame.getPose(e.inputSource.targetRaySpace, refSpace);
      if (pose) {
        lastHandWorld.set(
          pose.transform.position.x,
          pose.transform.position.y,
          pose.transform.position.z,
        );
      }
    }
    const h = hitTestFull(e.frame, e.inputSource);
    pinchStartX = h.localX;
    pinchStartUi = h.xrUi;
  };

  const onSelectEnd = (ev: Event) => {
    const e = ev as XRInputSourceEvent;
    const endHit = hitTestFull(e.frame, e.inputSource);
    const dx = endHit.localX - pinchStartX;
    const sameHand =
      !pinchRaySource ||
      !e.inputSource ||
      pinchRaySource === e.inputSource ||
      pinchRaySource.handedness === e.inputSource.handedness;

    if (pinchStartUi?.k === "launcher") {
      const swipeCards =
        useRayPick && Math.abs(dx) > 0.1
          ? dx > 0
          : !useRayPick && Math.abs(cursorX - pinchStartCursorX) > 55
            ? cursorX > pinchStartCursorX
            : null;
      if (swipeCards !== null) {
        launcherKind = swipeCards ? "badge" : "cards";
        sheetOpen = true;
        build();
      } else if (endHit.xrUi?.k === "launcher") {
        sheetOpen = !sheetOpen;
        build();
      } else if (sameHand && endHit.xrUi) {
        // Pinch-cursor: si parte sempre dal launcher; il tap vero è dove rilasci (tab, POI, ecc.).
        handleTap(endHit.xrUi);
      }
    } else if (sameHand && endHit.xrUi) {
      // Modalità ray: ignora “tap” se la mira è scivolata molto in orizzontale (drag).
      // Pinch-cursor: niente soglia su dx (il cursore si è già mosso in pixel).
      if (!useRayPick || Math.abs(dx) < 0.03) {
        handleTap(endHit.xrUi);
      }
    }

    pinchDown = false;
    pinchStartUi = null;
    pinchRaySource = null;
  };

  const attachHandlers = () => {
    const s = world.session ?? world.renderer?.xr?.getSession?.() ?? undefined;
    if (!s) return false;
    hideDom();
    s.addEventListener("selectstart", onSelectStart);
    s.addEventListener("selectend", onSelectEnd);
    s.addEventListener("select", onSelectEnd as EventListener);
    s.addEventListener("end", () => {
      showDom();
    });
    return true;
  };

  const handlersTimer = window.setInterval(() => {
    if (attachHandlers()) window.clearInterval(handlersTimer);
  }, 200);

  build();

  let raf = 0;
  let prev = 0;
  let frames = 0;
  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const delta = prev ? t - prev : 16;
    prev = t;
    if (!followCam) uiRoot.lookAt(world.camera.getWorldPosition(tmpPos));
    if (pinchDown && pinchStartUi?.k === "launcher" && pinchRaySource && useRayPick) {
      const frame = typeof world.renderer?.xr?.getFrame === "function" ? world.renderer.xr.getFrame() : null;
      const { localX } = hitTestRay(frame, pinchRaySource);
      const dx = localX - pinchStartX;
      if (Math.abs(dx) > 0.1) {
        const next = dx > 0 ? "badge" : "cards";
        if (next !== launcherKind) {
          launcherKind = next;
          sheetOpen = true;
          build();
        }
      }
    }
    if (pinchDown && pinchStartUi?.k === "launcher" && pinchRaySource && !useRayPick) {
      const dxPx = cursorX - pinchStartCursorX;
      if (Math.abs(dxPx) > 55) {
        const next = dxPx > 0 ? "badge" : "cards";
        if (next !== launcherKind) {
          launcherKind = next;
          sheetOpen = true;
          build();
        }
      }
    }
    const driftT = performance.now();
    for (const d of driftNodes) {
      applyUiDriftFloat(d.node, driftT, d.phase, reducedMotion);
    }
    uiRoot.update(delta);
    if (pinchDown && !useRayPick && pinchRaySource) {
      const frame = typeof world.renderer?.xr?.getFrame === "function" ? world.renderer.xr.getFrame() : null;
      if (frame) advanceCursorFromHandDelta(frame);
    }
    updateXrPointerRayVisual();

    frames++;
    if (frames % 15 === 0) {
      const cam = world.camera;
      const wx = uiRoot.getWorldPosition(new Vector3());
      const hint = opts.xrDomOverlayFallbackHint ?? "";
      hudEl.textContent =
        (hint ? `${hint}\n---\n` : "") +
        `XR HUD\ninput: ${useRayPick ? "ray" : "pinch-cursor"} | cursor: ${Math.round(cursorX)},${Math.round(cursorY)}\n` +
        `sheet: ${sheetOpen ? launcherKind : "closed"} | poiTab: ${poiCat}\n` +
        `freezeSvc: ${freezeServiceQueues ? "yes" : "no"} | queueAge: ${lastQueueTimesOk ? `${Math.round((Date.now() - lastQueueTimesOk) / 1000)}s` : "never"}\n` +
        `pois: ${rawPois.length}\n` +
        `ui.scale: ${uiRoot.scale.x.toFixed(6)} y: ${uiRoot.position.y.toFixed(3)} z: ${uiRoot.position.z.toFixed(3)}\n` +
        `cam: ${cam.position.x.toFixed(2)},${cam.position.y.toFixed(2)},${cam.position.z.toFixed(2)} | ui.world: ${wx.x.toFixed(2)},${wx.y.toFixed(2)},${wx.z.toFixed(2)}`;
    }
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.clearInterval(handlersTimer);
    window.clearInterval(seasonParcoTimer);
    window.clearInterval(queueTimesTimer);
    window.clearInterval(serviceQueueSimTimer);
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
    try {
      rayRoot.remove(rayLine);
      rayRoot.remove(hitDot);
      rayRoot.remove(cursorReticle);
      rayGeom.dispose();
      rayLineMat.dispose();
      hitDot.geometry.dispose();
      (hitDot.material as MeshBasicMaterial).dispose?.();
      cursorReticle.geometry.dispose();
      (cursorReticle.material as MeshBasicMaterial).dispose?.();
    } catch {
      // ignore
    }
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
    showDom();
  };
}
