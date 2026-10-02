"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import type { PhotoDTO } from "@/lib/photos";
import { useViewer } from "@/components/ViewerProvider";
import { applyFilters, facets, toQueryString, type Filters } from "./filters";
import { FilterBar } from "./FilterBar";
import { Masonry } from "./Masonry";
import { Lightbox } from "./Lightbox";

/*
 * Componente central de la galería (y de Favoritos):
 *   fotos del servidor → filtros/orden en el cliente → masonry → visor.
 * Filtrar en el cliente hace que el cambio sea instantáneo y animable. Los
 * filtros se reflejan en la URL (?categoria=paisaje&orden=nombre) para poder
 * compartir o recargar la vista.
 */
export function Gallery({
  photos, initialFilters, onlyFavorites = false, emptyMessage,
}: { photos: PhotoDTO[]; initialFilters: Filters; onlyFavorites?: boolean; emptyMessage?: React.ReactNode }) {
  const { favorites } = useViewer();
  const [filters, setFiltersState] = useState(initialFilters);
  const [openId, setOpenId] = useState<string | null>(null);
  const [originId, setOriginId] = useState<string | null>(null);

  const setFilters = (f: Filters) => {
    setFiltersState(f);
    window.history.replaceState(null, "", window.location.pathname + toQueryString(f));
  };

  // En Favoritos, al quitar un corazón la foto sale de la grilla con animación
  const source = useMemo(() => (onlyFavorites ? photos.filter((p) => favorites.has(p.id)) : photos), [photos, favorites, onlyFavorites]);
  const visible = useMemo(() => applyFilters(source, filters), [source, filters]);
  const available = useMemo(() => facets(source), [source]);

  return (
    <LayoutGroup>
      <FilterBar filters={filters} setFilters={setFilters} facets={available} count={visible.length} />
      <AnimatePresence mode="wait">
        {visible.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-32 text-center">
            {emptyMessage ?? <p className="font-display text-3xl font-light text-mist">Ninguna fotografía coincide con estos filtros.</p>}
          </motion.div>
        ) : (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Masonry photos={visible} onOpen={(id) => (setOriginId(id), setOpenId(id))} />
          </motion.div>
        )}
      </AnimatePresence>
      <Lightbox photos={visible} openId={openId} originId={originId} onChange={setOpenId} onClose={() => setOpenId(null)} />
    </LayoutGroup>
  );
}
