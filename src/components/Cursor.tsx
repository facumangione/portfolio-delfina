"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

/*
 * Cursor personalizado. Cualquier elemento con data-cursor="Texto" hace que el
 * cursor se convierta en un círculo con ese texto (p. ej. "Ver"). El círculo
 * sigue al mouse con un resorte (spring) para que el movimiento sea orgánico.
 * Sólo se activa en dispositivos con mouse.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.4 });

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    setEnabled(mq.matches);
    if (!mq.matches) return;
    const update = (target: Element | null) => {
      const el = target?.closest<HTMLElement>("[data-cursor]");
      // Sobre botones dentro de la foto volvemos al cursor normal
      const overControl = target?.closest("button, a[data-control]");
      setLabel(el && !overControl ? el.dataset.cursor || "" : null);
    };
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      update(e.target as Element);
    };
    // Tras un click o scroll, lo que hay bajo el puntero puede cambiar sin que el
    // mouse se mueva (p. ej. se abre el visor): volvemos a comprobarlo.
    const recheck = () => setTimeout(() => update(document.elementFromPoint(x.get(), y.get())), 60);
    window.addEventListener("pointermove", move);
    window.addEventListener("click", recheck);
    window.addEventListener("scroll", recheck, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("click", recheck);
      window.removeEventListener("scroll", recheck);
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100]"
      style={{ x: sx, y: sy }}
    >
      <AnimatePresence>
        {label !== null && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="-ml-11 -mt-11 flex h-22 w-22 items-center justify-center rounded-full border border-white/30 bg-black/30 text-[10px] tracking-[0.25em] text-white uppercase backdrop-blur-md"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
