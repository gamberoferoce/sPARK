import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Poi = {
  id: string;
  nome: string;
  categoria: "attrazione" | "ristoro" | "wc";
  coda_minuti?: number;
};

type Props = {
  open: boolean;
  poi: Poi | null;
  motivo: string;
  onClose: () => void;
  onNaviga: (poi: Poi) => void;
  variant?: "default" | "caffe";
};

function codaBadgeClasses(minuti: number) {
  if (minuti < 15) return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
  if (minuti <= 45) return "bg-yellow-500/15 text-yellow-200 ring-1 ring-yellow-500/30";
  return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30";
}

export function NotificationPopup({
  open,
  poi,
  motivo,
  onClose,
  onNaviga,
  variant = "default",
}: Props) {
  const visible = open && !!poi;
  const coda = typeof poi?.coda_minuti === "number" ? poi.coda_minuti : 0;
  const isCaffe = variant === "caffe";

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Chiudi notifica"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          >
            <div className="mx-3 mb-3 rounded-2xl bg-zinc-950/80 p-4 ring-1 ring-white/10 backdrop-blur">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                    <MapPin className="h-4 w-4 text-zinc-200" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-zinc-100">{poi!.nome}</div>
                    {!isCaffe ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            codaBadgeClasses(coda),
                          )}
                        >
                          {coda} min
                        </span>
                        <span className="text-xs text-zinc-400">Suggerimento</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-snug text-zinc-200/90">{motivo}</p>
              </div>

              <div
                className={cn(
                  "mt-4 gap-2",
                  isCaffe ? "grid grid-cols-2" : "flex items-center",
                )}
              >
                <Button
                  className={cn("justify-center", isCaffe ? "w-full min-w-0" : "flex-1")}
                  onClick={() => onNaviga(poi!)}
                >
                  Naviga
                  <ArrowUpRight className="ml-1.5" />
                </Button>
                <Button
                  variant="outline"
                  className={cn("bg-transparent", isCaffe ? "w-full min-w-0 justify-center" : "")}
                  onClick={onClose}
                >
                  Non ora
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
