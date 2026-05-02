import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { SPARK_ARTBOARD_WIDTH_PX } from "@/lib/layoutConstants";

type Props = {
  children: ReactNode;
  /** Larghezza di progetto in px (default = sheet desktop `max-w-lg`). */
  designWidth?: number;
  className?: string;
  innerClassName?: string;
};

/**
 * Mantiene il layout come sul desktop (artboard a larghezza fissa) e lo scala in modo uniforme
 * se lo schermo è più stretto, senza “strizzare” flex/grid come farebbe `50vw` o `max-w-full`.
 */
export function FixedArtboard({
  children,
  designWidth = SPARK_ARTBOARD_WIDTH_PX,
  className,
  innerClassName,
}: Props) {
  const [scale, setScale] = useState(1);
  const [boxH, setBoxH] = useState(0);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const update = () => {
      const vw = typeof window !== "undefined" ? window.innerWidth : designWidth;
      const pad = 16;
      const s = Math.min(1, Math.max(0.22, (vw - pad * 2) / designWidth));
      setScale(s);
      setBoxH(el.offsetHeight);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [designWidth]);

  const w = designWidth * scale;
  const h = boxH > 0 ? boxH * scale : undefined;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: w,
        height: h,
        marginLeft: "auto",
        marginRight: "auto",
        overflow: "visible",
      }}
    >
      <div
        ref={innerRef}
        className={innerClassName}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: designWidth,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
