import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Flame, Ruler, Sparkles, UtensilsCrossed } from "lucide-react";
import { driftFloatClassName } from "@/components/motion";
import { Button } from "@/components/ui/button";

export type Intensita = "bassa" | "media" | "alta";
export type Dieta = "normale" | "vegano" | "celiaco";

export type ProfiloUtente = {
  altezza_cm: number;
  diete: Dieta[];
  intensita: Intensita[];
};

type Props = {
  onComplete: (profilo: ProfiloUtente) => void;
};

const ALL_INTENSITA: Intensita[] = ["bassa", "media", "alta"];
const ALL_DIETE: Dieta[] = ["normale", "vegano", "celiaco"];
const INTENSITA_LABEL_EN: Record<Intensita, string> = {
  bassa: "Chill",
  media: "Adventurous",
  alta: "Extreme",
};
const DIETA_LABEL_EN: Record<Dieta, string> = {
  normale: "I eat everything",
  vegano: "Vegan",
  celiaco: "Gluten free",
};

const STEP_ICONS = [Sparkles, Ruler, UtensilsCrossed, Flame] as const;

const HEIGHT_MIN = 90;
const HEIGHT_MAX = 210;
const HEIGHTS = Array.from({ length: HEIGHT_MAX - HEIGHT_MIN + 1 }, (_, i) => HEIGHT_MIN + i);
const HEIGHT_ITEM_PX = 48;

function scaleOpacityFromSlotDistance(d: number): { scale: number; opacity: number } {
  const a = Math.abs(d);
  const lerp = (t: number, x0: number, x1: number) => x0 + (x1 - x0) * t;
  let scale: number;
  let opacity: number;
  if (a <= 1) {
    scale = lerp(a, 1.15, 1.05);
    opacity = lerp(a, 1, 0.72);
  } else if (a <= 2) {
    scale = lerp(a - 1, 1.05, 0.98);
    opacity = lerp(a - 1, 0.72, 0.48);
  } else if (a <= 3) {
    scale = lerp(a - 2, 0.98, 0.9);
    opacity = lerp(a - 2, 0.48, 0.32);
  } else {
    scale = 0.9;
    opacity = 0.32;
  }
  return { scale, opacity };
}

function HeightTick({
  index,
  label,
  scrollLeft,
  sidePadRef,
  viewportWRef,
}: {
  index: number;
  label: number;
  scrollLeft: number;
  sidePadRef: MutableRefObject<number>;
  viewportWRef: MutableRefObject<number>;
}) {
  const scale = useMemo(() => {
    const sl = scrollLeft;
    const side = sidePadRef.current;
    const vw = viewportWRef.current;
    if (vw <= 0 || side < 0) return 0.9;
    const vpHalf = vw / 2;
    const itemCenter = side + index * HEIGHT_ITEM_PX + HEIGHT_ITEM_PX / 2;
    const viewportCenterContent = sl + vpHalf;
    const d = (viewportCenterContent - itemCenter) / HEIGHT_ITEM_PX;
    return scaleOpacityFromSlotDistance(d).scale;
  }, [index, scrollLeft, sidePadRef, viewportWRef]);

  const opacity = useMemo(() => {
    const sl = scrollLeft;
    const side = sidePadRef.current;
    const vw = viewportWRef.current;
    if (vw <= 0 || side < 0) return 0.32;
    const vpHalf = vw / 2;
    const itemCenter = side + index * HEIGHT_ITEM_PX + HEIGHT_ITEM_PX / 2;
    const viewportCenterContent = sl + vpHalf;
    const d = (viewportCenterContent - itemCenter) / HEIGHT_ITEM_PX;
    return scaleOpacityFromSlotDistance(d).opacity;
  }, [index, scrollLeft, sidePadRef, viewportWRef]);

  const color = useMemo(() => {
    const sl = scrollLeft;
    const side = sidePadRef.current;
    const vw = viewportWRef.current;
    if (vw <= 0 || side < 0) return 0;
    const vpHalf = vw / 2;
    const itemCenter = side + index * HEIGHT_ITEM_PX + HEIGHT_ITEM_PX / 2;
    const viewportCenterContent = sl + vpHalf;
    const d = Math.abs((viewportCenterContent - itemCenter) / HEIGHT_ITEM_PX);
    return d < 0.55 ? 1 : 0;
  }, [index, scrollLeft, sidePadRef, viewportWRef]);
  const textColor = color > 0.5 ? "rgb(244 244 245)" : "rgb(161 161 170)";
  const fontWeight = color > 0.5 ? 600 : 500;
  const finalTextColor = color > 0.5 ? "#ffffff" : textColor;

  return (
    <div
      style={{
        width: HEIGHT_ITEM_PX,
        flex: `0 0 ${HEIGHT_ITEM_PX}px`,
        transform: `scale(${scale})`,
        opacity,
        color: finalTextColor,
        fontWeight,
      }}
      className="pointer-events-none snap-center scroll-mx-0 py-2 text-center text-sm tabular-nums transition-[transform,opacity] duration-200 will-change-transform motion-reduce:transition-none"
      aria-hidden
    >
      {label}
    </div>
  );
}

function HeightCenterCarousel({
  value,
  onChange,
  active,
}: {
  value: number;
  onChange: (cm: number) => void;
  active: boolean;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScroll: number; pointerId: number } | null>(null);
  const [sidePad, setSidePad] = useState(0);
  const [viewportW, setViewportW] = useState(0);
  const sidePadRef = useRef(0);
  const viewportWRef = useRef(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const centerLineOpacity = useMemo(() => {
    const cell = scrollLeft / HEIGHT_ITEM_PX;
    const frac = cell - Math.floor(cell);
    const d = Math.min(frac, 1 - frac) * 2;
    return 0.22 + (1 - d) * 0.2;
  }, [scrollLeft]);
  const valueRef = useRef(value);
  const scrollRaf = useRef(0);
  valueRef.current = value;
  sidePadRef.current = sidePad;
  viewportWRef.current = viewportW;

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setSidePad(Math.max(0, (w - HEIGHT_ITEM_PX) / 2));
      setViewportW(w);
    });
    ro.observe(el);
    const w = el.clientWidth;
    setSidePad(Math.max(0, (w - HEIGHT_ITEM_PX) / 2));
    setViewportW(w);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || sidePad <= 0 || !active) return;
    const v = valueRef.current;
    const i = Math.max(0, Math.min(HEIGHTS.length - 1, v - HEIGHT_MIN));
    el.scrollLeft = i * HEIGHT_ITEM_PX;
    setScrollLeft(el.scrollLeft);
  }, [active, sidePad]);

  const commitFromScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = requestAnimationFrame(() => {
      setScrollLeft(el.scrollLeft);
      const i = Math.round(el.scrollLeft / HEIGHT_ITEM_PX);
      const clamped = Math.max(0, Math.min(HEIGHTS.length - 1, i));
      const cm = HEIGHT_MIN + clamped;
      if (cm !== value) onChange(cm);
    });
  };

  const syncScrollMotion = () => {
    const el = scrollerRef.current;
    if (el) setScrollLeft(el.scrollLeft);
  };

  const scrollToCm = (cm: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.max(0, Math.min(HEIGHTS.length - 1, cm - HEIGHT_MIN));
    el.scrollTo({ left: i * HEIGHT_ITEM_PX, behavior });
    requestAnimationFrame(syncScrollMotion);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    dragRef.current = { startX: e.clientX, startScroll: el.scrollLeft, pointerId: e.pointerId };
    el.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = d.startScroll - (e.clientX - d.startX);
  };

  const endPointerDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      scrollerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const el = scrollerRef.current;
    if (el) {
      const i = Math.round(el.scrollLeft / HEIGHT_ITEM_PX);
      const clamped = Math.max(0, Math.min(HEIGHTS.length - 1, i));
      el.scrollTo({ left: clamped * HEIGHT_ITEM_PX, behavior: "smooth" });
    }
    requestAnimationFrame(() => {
      syncScrollMotion();
      commitFromScroll();
    });
  };

  return (
    <div ref={measureRef} className="mt-4">
      <div className="relative -mx-1">
        <div
          className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 h-px w-10 -translate-x-1/2 bg-white"
          style={{ opacity: centerLineOpacity }}
          aria-hidden
        />

        <div
          ref={scrollerRef}
          role="slider"
          aria-valuemin={HEIGHT_MIN}
          aria-valuemax={HEIGHT_MAX}
          aria-valuenow={value}
          aria-label="Height in centimeters"
          tabIndex={0}
          onScroll={() => {
            setScrollLeft(scrollerRef.current?.scrollLeft ?? 0);
            commitFromScroll();
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={(e) => {
            handlePointerMove(e);
            syncScrollMotion();
          }}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              const next = Math.max(HEIGHT_MIN, value - 1);
              onChange(next);
              scrollToCm(next, "smooth");
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              const next = Math.min(HEIGHT_MAX, value + 1);
              onChange(next);
              scrollToCm(next, "smooth");
            }
          }}
          className="cursor-grab touch-pan-x snap-x snap-mandatory overflow-x-auto overflow-y-hidden pb-1 outline-none active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] select-none focus-visible:ring-2 focus-visible:ring-white/20 [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max" style={{ paddingLeft: sidePad, paddingRight: sidePad }}>
            {HEIGHTS.map((h) => (
              <HeightTick
                key={h}
                index={h - HEIGHT_MIN}
                label={h}
                scrollLeft={scrollLeft}
                sidePadRef={sidePadRef}
                viewportWRef={viewportWRef}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [altezza, setAltezza] = useState<number>(160);
  const [diete, setDiete] = useState<Record<Dieta, boolean>>({
    normale: false,
    vegano: false,
    celiaco: false,
  });
  const [intensita, setIntensita] = useState<Record<Intensita, boolean>>({
    bassa: false,
    media: false,
    alta: false,
  });

  const profilo = useMemo<ProfiloUtente>(() => {
    const dieteSel = ALL_DIETE.filter((d) => diete[d]);
    const sel = ALL_INTENSITA.filter((i) => intensita[i]);
    return {
      altezza_cm: altezza,
      diete: dieteSel.length ? dieteSel : ["normale"],
      intensita: sel.length ? sel : ALL_INTENSITA,
    };
  }, [altezza, diete, intensita]);

  const StepIcon = STEP_ICONS[step];

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex min-h-[100dvh] items-center justify-center px-4">
      <div className="pointer-events-auto flex h-[42dvh] max-h-[42dvh] w-full max-w-lg flex-col bg-transparent">
        <main className="flex min-h-0 w-full flex-1 flex-col px-4">
          <div className="shrink-0 pb-3 pt-2">
            <div className="mt-2 grid grid-cols-4 gap-2">
              {([0, 1, 2, 3] as const).map((i) => {
                const done = i < step;
                const on = i === step;
                const disabled = i > step;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (i <= step) setStep(i);
                    }}
                    aria-label={`Vai allo step ${i + 1}`}
                    className={[
                      "h-2 rounded-full transition-colors",
                      on ? "bg-white/30" : done ? "bg-white/15 hover:bg-white/20" : "bg-white/5",
                      disabled ? "opacity-40" : "",
                    ].join(" ")}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
            <div className="mx-auto flex min-h-full w-full max-w-full flex-col justify-center py-2">
              <div className="relative p-3">
                {step === 0 ? (
                  <div className="flex w-full flex-col items-center justify-center">
                    <div className="mx-auto w-full max-w-lg">
                      <div className="flex w-full justify-center">
                        <div className="flex w-fit max-w-full flex-row items-center gap-3 text-left sm:gap-4">
                          <img
                            src="/spark-mascot.png"
                            alt=""
                            className={driftFloatClassName(
                              "shrink-0 h-[clamp(5.5rem,26vw,9.5rem)] w-auto max-w-[min(42vw,168px)] object-contain object-left select-none pointer-events-none",
                            )}
                            draggable={false}
                          />
                          <div className="min-w-0 max-w-[min(52vw,260px)] space-y-1.5">
                            <p className="text-xl font-semibold leading-tight tracking-wide text-zinc-50 sm:text-2xl">
                              Welcome to sPARK
                            </p>
                            <p className="text-sm font-medium leading-relaxed text-zinc-200">
                              Your AR app for theme parks.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent ring-1 ring-white">
                      <StepIcon className="h-4 w-4 text-zinc-200" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div>
                        <div className="text-sm font-semibold text-zinc-100">Are you tall enough?</div>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          We&apos;ll show you all the rides you can jump on.
                        </p>

                        <HeightCenterCarousel
                          value={altezza}
                          onChange={setAltezza}
                          active={step === 1}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="flex w-full flex-col">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent ring-1 ring-white">
                        <StepIcon className="h-4 w-4 text-zinc-200" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-100">Any dietary preferences?</div>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          We&apos;ll filter the rest out.
                        </p>
                      </div>
                    </div>
                    <div className="mx-auto mt-4 w-full max-w-sm space-y-3">
                      {ALL_DIETE.map((d) => {
                        const on = diete[d];
                        return (
                          <button
                            key={d}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setDiete((prev) => ({ ...prev, [d]: !prev[d] }))}
                            className={[
                              "w-full rounded-[3rem] px-3 py-3 text-left text-sm font-semibold capitalize ring-1 transition-colors",
                              on
                                ? "bg-white/10 text-zinc-100 ring-white/20"
                                : "bg-zinc-900/40 text-zinc-400 ring-white/10 hover:bg-white/5 hover:text-zinc-200",
                            ].join(" ")}
                          >
                            {DIETA_LABEL_EN[d]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="flex w-full flex-col">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent ring-1 ring-white">
                        <StepIcon className="h-4 w-4 text-zinc-200" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-100">
                          How much adrenaline can you handle?
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-400">Pick as many as you like</p>
                      </div>
                    </div>
                    <div className="mx-auto mt-4 w-full max-w-sm space-y-3">
                      {ALL_INTENSITA.map((a) => {
                        const on = intensita[a];
                        return (
                          <button
                            key={a}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setIntensita((prev) => ({ ...prev, [a]: !prev[a] }))}
                            className={[
                              "w-full rounded-[3rem] px-3 py-3 text-left text-sm font-semibold capitalize ring-1 transition-colors",
                              on
                                ? "bg-white/10 text-zinc-100 ring-white/20"
                                : "bg-zinc-900/40 text-zinc-400 ring-white/10 hover:bg-white/5 hover:text-zinc-200",
                            ].join(" ")}
                          >
                            {INTENSITA_LABEL_EN[a]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </main>

        <footer className="shrink-0 bg-transparent px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
          {step === 0 ? (
            <div className="flex w-full justify-center">
              <Button
                variant="outline"
                size="lg"
                className="bg-transparent min-w-[96px]"
                onClick={() => setStep(1)}
              >
                Next
              </Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                variant="outline"
                size="lg"
                className="bg-transparent min-w-[96px]"
                onClick={() => setStep((s) => (s === 0 ? 0 : ((s - 1) as 0 | 1 | 2 | 3)))}
              >
                Back
              </Button>

              {step < 3 ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="bg-transparent min-w-[96px]"
                  onClick={() => setStep((s) => ((s + 1) as 0 | 1 | 2 | 3))}
                >
                  Next
                </Button>
              ) : (
                <Button size="lg" className="min-w-[96px]" onClick={() => onComplete(profilo)}>
                  Start
                </Button>
              )}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
