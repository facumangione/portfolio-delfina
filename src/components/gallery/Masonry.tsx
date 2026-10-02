"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { PhotoDTO } from "@/lib/photos";
import { useMasonry } from "./useMasonry";
import { PhotoCard } from "./PhotoCard";
import { EASE_CINE } from "@/components/motion/easing";

/*
 * Galería masonry animada. Cada foto está posicionada en absoluto (x, y) según
 * useMasonry. Con AnimatePresence:
 *  - las fotos que dejan de cumplir el filtro salen (fade + escala),
 *  - las que siguen se deslizan a su nueva posición,
 *  - las nuevas aparecen escalonadas.
 */
export function Masonry({ photos, onOpen }: { photos: PhotoDTO[]; onOpen: (id: string) => void }) {
  const { ref, positions, height } = useMasonry(photos);

  return (
    <motion.div
      ref={ref}
      className="relative w-full"
      animate={{ height }}
      transition={{ duration: 0.8, ease: EASE_CINE }}
    >
      <AnimatePresence>
        {photos.map((photo, i) => {
          const pos = positions.get(photo.id);
          if (!pos) return null;
          return (
            <motion.div
              key={photo.id}
              className="absolute top-0 left-0"
              initial={{ opacity: 0, x: pos.x, y: pos.y + 30, width: pos.w, height: pos.h }}
              animate={{
                opacity: 1, x: pos.x, y: pos.y, width: pos.w, height: pos.h,
                transition: { duration: 0.9, ease: EASE_CINE, delay: Math.min(i * 0.035, 0.4) },
              }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.4, ease: EASE_CINE } }}
            >
              <PhotoCard photo={photo} index={i} onOpen={() => onOpen(photo.id)} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
