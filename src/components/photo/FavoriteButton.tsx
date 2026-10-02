"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useViewer } from "@/components/ViewerProvider";
import { cn } from "@/lib/utils";

/*
 * Corazón de favoritos. Al marcarlo:
 *  - el botón hace un pequeño "pulso" (scale 1 → 1.25 → 1),
 *  - el relleno aparece desde el centro,
 *  - un anillo se expande y desvanece una sola vez.
 */
export function FavoriteButton({ photoId, className, withLabel }: { photoId: string; className?: string; withLabel?: boolean }) {
  const { favorites, toggleFavorite } = useViewer();
  const active = favorites.has(photoId);

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(photoId);
      }}
      whileTap={{ scale: 0.85 }}
      aria-pressed={active}
      aria-label={active ? "Quitar de favoritos" : "Agregar a favoritos"}
      className={cn("group/fav relative inline-flex items-center gap-2.5 text-bone", className)}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <AnimatePresence>
          {active && (
            <motion.span
              key="ring"
              className="absolute inset-0 rounded-full border border-accent"
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>
        <motion.svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          animate={active ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.path
            d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.4 1.1 4.8 2.8 1.4-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={1.2}
            initial={false}
            animate={{ fillOpacity: active ? 1 : 0, color: active ? "#d8c3a5" : "#ecebe6" }}
            transition={{ duration: 0.35 }}
          />
        </motion.svg>
      </span>
      {withLabel && (
        <span className="eyebrow text-bone/80! transition-colors group-hover/fav:text-bone!">
          {active ? "En favoritos" : "Favorito"}
        </span>
      )}
    </motion.button>
  );
}
