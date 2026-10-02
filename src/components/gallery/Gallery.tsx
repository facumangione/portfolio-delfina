"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import type { PhotoDTO, PhotoPage } from "@/lib/photos";
import { useViewer } from "@/components/ViewerProvider";
import { toQueryString, type Facets, type Filters } from "./filters";
import { FilterBar } from "./FilterBar";
import { Masonry } from "./Masonry";
import { Lightbox } from "./Lightbox";

/*
 * Componente central de la galería (y de Favoritos).
 *
 * Pensado para cientos o miles de fotos:
 *  - El servidor entrega sólo la primera página (30 fotos).
 *  - Al acercarse al final, se pide la siguiente a /api/photos (scroll infinito).
 *  - Al cambiar un filtro, se pide de nuevo la página 1 con los filtros nuevos;
 *    mientras llega, la grilla actual se atenúa y luego se reemplaza animada.
 *  - Los filtros se reflejan en la URL para poder compartir la vista.
 */
export function Gallery({
  initialPage, initialFilters, facets, onlyFavorites = false, emptyMessage,
}: {
  initialPage: PhotoPage;
  initialFilters: Filters;
  facets: Facets;
  onlyFavorites?: boolean;
  emptyMessage?: React.ReactNode;
}) {
  const { favorites } = useViewer();
  const [filters, setFiltersState] = useState(initialFilters);
  const [photos, setPhotos] = useState(initialPage.photos);
  const [total, setTotal] = useState(initialPage.total);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [loading, setLoading] = useState<"none" | "replace" | "more">("none");
  const [openId, setOpenId] = useState<string | null>(null);
  const [originId, setOriginId] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (f: Filters, offset: number) => {
      request.current?.abort();
      const ctrl = new AbortController();
      request.current = ctrl;
      const qs = toQueryString(f, { offset: String(offset), ...(onlyFavorites ? { favoritas: "1" } : {}) });
      const res = await fetch(`/api/photos${qs}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error("No se pudieron cargar las fotos");
      return (await res.json()) as PhotoPage;
    },
    [onlyFavorites],
  );

  // Cambio de filtros → se reemplaza la lista (debounce para la búsqueda de texto)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.history.replaceState(null, "", window.location.pathname + toQueryString(filters));
    setLoading("replace");
    const t = setTimeout(async () => {
      try {
        const page = await fetchPage(filters, 0);
        setPhotos(page.photos);
        setTotal(page.total);
        setNextOffset(page.nextOffset);
        setLoading("none");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setLoading("none");
      }
    }, filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [filters, fetchPage]);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loading !== "none") return;
    setLoading("more");
    try {
      const page = await fetchPage(filters, nextOffset);
      // Evitamos duplicados si algo cambió entre páginas
      setPhotos((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.photos.filter((p) => !seen.has(p.id))];
      });
      setTotal(page.total);
      setNextOffset(page.nextOffset);
    } catch {
      /* se reintenta al volver a llegar al final */
    }
    setLoading("none");
  }, [nextOffset, loading, fetchPage, filters]);

  // Scroll infinito: cuando el "centinela" al final de la grilla se acerca a la
  // pantalla (1200px antes), pedimos la página siguiente.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // En Favoritos, al quitar un corazón la foto sale de la grilla con animación
  const visible = useMemo(() => (onlyFavorites ? photos.filter((p) => favorites.has(p.id)) : photos), [photos, favorites, onlyFavorites]);
  const shownTotal = onlyFavorites ? total - (photos.length - visible.length) : total;

  return (
    <LayoutGroup>
      <FilterBar filters={filters} setFilters={setFiltersState} facets={facets} count={shownTotal} />
      <AnimatePresence mode="wait">
        {visible.length === 0 && loading === "none" ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-32 text-center">
            {emptyMessage ?? <p className="font-display text-3xl font-light text-mist">Ninguna fotografía coincide con estos filtros.</p>}
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: loading === "replace" ? 0.35 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Masonry photos={visible} onOpen={(id) => (setOriginId(id), setOpenId(id))} />
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={sentinel} aria-hidden className="h-px" />
      <AnimatePresence>
        {loading === "more" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-16">
            <span className="h-5 w-5 animate-spin rounded-full border border-mist border-t-bone" />
          </motion.div>
        )}
      </AnimatePresence>
      {nextOffset === null && visible.length > 12 && <p className="eyebrow py-20 text-center">Fin del archivo · {shownTotal} fotografías</p>}

      <Lightbox
        photos={visible}
        total={shownTotal}
        openId={openId}
        originId={originId}
        onChange={(id) => {
          setOpenId(id);
          // Si el visor se acerca a la última foto cargada, traemos más
          if (visible.findIndex((p) => p.id === id) >= visible.length - 3) loadMore();
        }}
        onClose={() => setOpenId(null)}
      />
    </LayoutGroup>
  );
}
