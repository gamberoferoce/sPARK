import { ArrowUpRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Poi } from "@/types/poi";

type Props = {
  open: boolean;
  poi: Poi | null;
  motivo: string;
  sottotitolo?: string;
  onClose?: () => void;
  onChiudi?: () => void;
  onNaviga: (poi: Poi) => void;
  variant?: "default" | "caffe";
  tipo?: "attrazione" | "ristoro";
};

export function NotificationPopup({
  open,
  poi,
  motivo,
  sottotitolo,
  onClose,
  onChiudi,
  onNaviga,
}: Props) {
  const visible = open && !!poi;
  const close = onClose ?? onChiudi ?? (() => {});
  // Uniform UI: always use the "coffee" layout for all notifications
  const isCaffe = true;

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 opacity-100 transition-opacity duration-300"
        aria-label="Close notification"
        onClick={close}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: "translateY(0px) scale(1)" }}
      >
        <div className="rounded-2xl bg-zinc-950/80 p-4 ring-1 ring-white/10 backdrop-blur">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <MapPin className="h-4 w-4 text-zinc-200" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-zinc-100">{motivo}</div>
                <div className="mt-0.5 truncate text-xs text-zinc-400">{sottotitolo ?? poi!.nome}</div>
              </div>
            </div>

            <p className="mt-3 text-sm leading-snug text-zinc-200/90">{poi!.nome}</p>
          </div>

          <div className={cn("mt-4 gap-2", isCaffe ? "grid grid-cols-2" : "flex items-center")}>
            <Button className={cn("justify-center", isCaffe ? "w-full min-w-0" : "flex-1")} onClick={() => onNaviga(poi!)}>
              Navigate
              <ArrowUpRight className="ml-1.5" />
            </Button>
            <Button
              variant="outline"
              className={cn("bg-transparent", isCaffe ? "w-full min-w-0 justify-center" : "")}
              onClick={close}
            >
              Non ora
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
