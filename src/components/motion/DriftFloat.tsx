import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Classe globale definita in `src/styles/ui-drift-float.css` (importata da `index.css`). */
export const DRIFT_FLOAT_CLASS = "ui-drift-float";

/** Unisce la classe di animazione ad altre classi Tailwind / condizionali. */
export function driftFloatClassName(...parts: Array<string | undefined | false>) {
  return cn(DRIFT_FLOAT_CLASS, ...parts);
}

/**
 * Wrapper `<div>` con il loop CSS. Per `<img>` o altri tag usa `className={driftFloatClassName("…")}`.
 */
export function DriftFloat({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={driftFloatClassName(className)} {...props} />;
}
