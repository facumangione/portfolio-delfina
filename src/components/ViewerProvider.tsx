"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/*
 * Estado del visitante disponible en cualquier componente cliente:
 * quién es, si puede descargar, y el conjunto de fotos favoritas.
 * Así el corazón de una tarjeta, del visor y de la página individual
 * siempre muestran el mismo estado.
 */

export interface Viewer {
  id: string;
  name: string;
  role: string;
  canDownload: boolean;
}

interface ViewerCtx {
  viewer: Viewer | null;
  favorites: Set<string>;
  toggleFavorite: (photoId: string) => Promise<void>;
}

const Ctx = createContext<ViewerCtx | null>(null);

export function ViewerProvider({
  viewer,
  initialFavorites,
  children,
}: {
  viewer: Viewer | null;
  initialFavorites: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [favorites, setFavorites] = useState(() => new Set(initialFavorites));

  const toggleFavorite = useCallback(
    async (photoId: string) => {
      if (!viewer) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const wasFavorite = favorites.has(photoId);
      // Actualización optimista: cambiamos la UI ya y luego confirmamos con el servidor
      const apply = (fav: boolean) =>
        setFavorites((prev) => {
          const next = new Set(prev);
          if (fav) next.add(photoId);
          else next.delete(photoId);
          return next;
        });
      apply(!wasFavorite);
      const res = await fetch("/api/favorites", {
        method: wasFavorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (!res.ok) apply(wasFavorite); // si falla, revertimos
    },
    [favorites, viewer, router],
  );

  return <Ctx.Provider value={{ viewer, favorites, toggleFavorite }}>{children}</Ctx.Provider>;
}

export function useViewer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useViewer debe usarse dentro de <ViewerProvider>");
  return ctx;
}
