"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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
 *
 * "Virtualización": aunque haya cientos de fotos cargadas, sólo se dibujan las
 * que están cerca de la pantalla (una franja de ~1,5 pantallas arriba y abajo).
 * Como ya conocemos la posición de cada una, saber cuáles se ven es inmediato.
 * Así el navegador mantiene pocas decenas de imágenes en el DOM y el scroll
 * sigue fluido.
 */
const BUFFER = 1.5; // pantallas extra arriba y abajo
const STEP = 300; // sólo recalculamos cuando el scroll avanza 300px

export function Masonry({ photos, onOpen }: { photos: PhotoDTO[]; onOpen: (id: string) => void }) {
  const { ref, positions, height } = useMasonry(photos);
  const [range, setRange] = useState({ top: -Infinity, bottom: Infinity });

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const containerTop = el.getBoundingClientRect().top; // relativo a la ventana
        const vh = window.innerHeight;
        const top = Math.floor((-containerTop - vh * BUFFER) / STEP) * STEP;
        const bottom = Math.ceil((-containerTop + vh * (1 + BUFFER)) / STEP) * STEP;
        setRange((r) => (r.top === top && r.bottom === bottom ? r : { top, bottom }));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref, height]);

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
          if (!pos || pos.y + pos.h < range.top || pos.y > range.bottom) return null;
          return (
            <motion.div
              key={photo.id}
              className="absolute top-0 left-0"
              initial={{ opacity: 0, x: pos.x, y: pos.y + 30, width: pos.w, height: pos.h }}
              animate={{
                opacity: 1, x: pos.x, y: pos.y, width: pos.w, height: pos.h,
                transition: { duration: 0.9, ease: EASE_CINE, delay: Math.min((i % 12) * 0.035, 0.4) },
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
