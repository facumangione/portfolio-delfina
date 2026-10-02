"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/*
 * Cálculo del layout "masonry editorial".
 *
 * En lugar de usar columnas CSS, calculamos nosotros la posición (x, y) y el
 * tamaño de cada foto. Ventaja: al filtrar, cada foto conoce su posición nueva
 * y puede DESLIZARSE hasta ella con una animación, en vez de saltar.
 *
 * Algoritmo: cada foto se coloca en la columna más baja en ese momento. Las fotos
 * destacadas y apaisadas pueden ocupar 2 columnas, para romper la grilla y darle
 * ritmo editorial a la composición.
 */

export interface MasonryItem {
  id: string;
  width: number;
  height: number;
  featured?: boolean;
}

export interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
}

function columnsFor(width: number) {
  if (width < 560) return 1;
  if (width < 1000) return 2;
  if (width < 1600) return 3;
  return 4;
}

export function useMasonry<T extends MasonryItem>(items: T[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const positions = new Map<string, Placement>();
    if (!width) return { positions, height: 0 };
    const cols = columnsFor(width);
    const gap = width < 560 ? 16 : width < 1000 ? 24 : 36;
    const colW = (width - gap * (cols - 1)) / cols;
    const heights = new Array(cols).fill(0);
    let wideCount = 0;

    for (const item of items) {
      const ratio = item.width / item.height;
      // Candidata a foto ancha: destacada y apaisada, o cada tanto una apaisada para dar ritmo
      const candidate = cols >= 3 && ratio > 1.3 && (item.featured || wideCount % 4 === 3);
      if (ratio > 1.3) wideCount++;

      // Buscamos el par de columnas contiguas cuya parte más alta sea la más baja
      let best = 0;
      let bestTop = Infinity;
      if (candidate) {
        for (let c = 0; c < cols - 1; c++) {
          const top = Math.max(heights[c], heights[c + 1]);
          if (top < bestTop - 1) {
            bestTop = top;
            best = c;
          }
        }
      }
      // Sólo la ensanchamos si no deja huecos grandes en la composición
      const tolerance = colW * 0.2;
      const wide =
        candidate &&
        Math.abs(heights[best] - heights[best + 1]) < tolerance &&
        bestTop - Math.min(...heights) < tolerance;

      if (wide) {
        const w = colW * 2 + gap;
        const h = w / ratio;
        positions.set(item.id, { x: best * (colW + gap), y: bestTop, w, h });
        heights[best] = heights[best + 1] = bestTop + h + gap;
      } else {
        const c = heights.indexOf(Math.min(...heights));
        const h = colW / ratio;
        positions.set(item.id, { x: c * (colW + gap), y: heights[c], w: colW, h });
        heights[c] += h + gap;
      }
    }
    return { positions, height: Math.max(0, Math.max(...heights) - gap) };
  }, [items, width]);

  return { ref, ...layout };
}
