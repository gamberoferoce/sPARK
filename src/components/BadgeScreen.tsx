import type { Poi } from "@/types/poi";
import { BadgeCollection } from "@/components/BadgeCollection";
import { BadgeScanner } from "@/components/BadgeScanner";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  attrazioni: Poi[];
  badgesSbloccati: string[];
  onBadgeUnlocked: (attrazioneId: string) => void;
  onClose: () => void;
};

export function BadgeScreen({ open, attrazioni, badgesSbloccati, onBadgeUnlocked, onClose }: Props) {
  if (!open) return null;

  const [tab, setTab] = useState<"galleria" | "scansiona">("galleria");
  const [scanActive, setScanActive] = useState(false);

  const totale = attrazioni.length;
  const sbloccati = attrazioni.filter((a) => badgesSbloccati.includes(a.id)).length;
  const tabs = useMemo(
    () => [
      { id: "galleria" as const, label: "Gallery" },
      { id: "scansiona" as const, label: "Scan" },
    ],
    [],
  );

  return (
    <div className="fixed left-1/2 top-14 z-[85] w-[min(50vw,32rem)] -translate-x-1/2 bg-transparent px-0 pt-0 pb-0 max-h-[calc(100dvh-4.5rem)] overflow-y-auto overflow-x-visible">
      <div className="mx-auto w-full max-w-lg">
        <nav className="grid w-full grid-cols-2 items-center justify-items-stretch px-4 pt-0.5" aria-label="Badge tabs">
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <div key={t.id} className="flex justify-center px-0.5">
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "min-h-[36px] w-full max-w-[132px] whitespace-nowrap text-center text-[14px] leading-tight transition-colors duration-150",
                    on
                      ? "rounded-full px-4 py-2 font-normal text-white bg-zinc-600/50 shadow-inner shadow-black/20 ring-1 ring-white/10 hover:bg-zinc-500/50"
                      : "rounded-full bg-transparent px-2 py-2 font-normal text-white hover:bg-white/[0.08] hover:text-zinc-100",
                  )}
                >
                  {t.label}
                </button>
              </div>
            );
          })}
        </nav>

        {tab === "galleria" ? (
          <>
            <BadgeCollection
              attrazioni={attrazioni}
              badgesSbloccati={badgesSbloccati}
              showHeader={false}
              variant="row"
            />
            <div className="mt-1 text-center text-xs text-zinc-400">
              {sbloccati}/{totale} badges unlocked
            </div>
          </>
        ) : (
          <div className="mt-4 relative">
            <div className="relative h-[70dvh] w-full overflow-hidden rounded-3xl ring-1 ring-white/10">
              {/* Area scansione: camera + mirino (BadgeScanner gestisce cue minimal) */}
              <BadgeScanner
                open={scanActive}
                attrazioni={attrazioni}
                onBadgeUnlocked={onBadgeUnlocked}
                onSuccessDone={() => {
                  setScanActive(false);
                  setTab("galleria");
                }}
                onFailExit={() => {
                  setScanActive(false);
                  onClose();
                }}
                containerClassName="absolute inset-0 bg-black"
                reticlePlacement="betweenTopAndButton"
              />

              {!scanActive ? (
                <div className="absolute inset-0 bg-black" />
              ) : null}

              {/* Button placed lower */}
              <div className="absolute bottom-6 right-6">
                <button
                  type="button"
                  className="rounded-full bg-zinc-950/80 px-6 py-3 text-sm font-semibold text-zinc-100 ring-1 ring-white/10 backdrop-blur transition-colors duration-150 hover:bg-white/10"
                  onClick={() => setScanActive(true)}
                >
                  Start scanning
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

