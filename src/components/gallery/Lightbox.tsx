"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import type { PhotoDTO } from "@/lib/photos";
import { formatBytes, formatDate, megapixels, resolutionLabel } from "@/lib/utils";
import { FavoriteButton } from "@/components/photo/FavoriteButton";
import { DownloadButton } from "@/components/photo/DownloadButton";
import { TLink } from "@/components/motion/PageTransition";
import { EASE_CINE } from "@/components/motion/easing";

/*
 * Visor a pantalla completa.
 *  - La imagen comparte layoutId con la miniatura: Framer Motion anima su caja
 *    desde la posición de la tarjeta hasta el centro (efecto "expandir").
 *  - El fondo se oscurece con un fade.
 *  - Los controles aparecen después, escalonados, para no competir con la foto.
 *  - Teclado: ← → para navegar, i para información, Esc para cerrar.
 */

const controlsVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.35 + i * 0.08, duration: 0.6, ease: EASE_CINE } }),
};

function useViewport() {
  const [vp, setVp] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return vp;
}

export function Lightbox({
  photos, total, openId, originId, onChange, onClose,
}: {
  photos: PhotoDTO[];
  total?: number;
  openId: string | null;
  originId: string | null;
  onChange: (id: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [info, setInfo] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const vp = useViewport();
  useEffect(() => setMounted(true), []);

  const index = photos.findIndex((p) => p.id === openId);
  const photo = index >= 0 ? photos[index] : null;

  const go = useCallback(
    (dir: 1 | -1) => {
      if (index < 0 || photos.length < 2) return;
      onChange(photos[(index + dir + photos.length) % photos.length].id);
    },
    [index, photos, onChange],
  );

  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key.toLowerCase() === "i") setInfo((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [photo, go, onClose]);

  if (!mounted) return null;

  // Tamaño que ocupa la foto: lo más grande posible respetando su proporción
  let box = { w: 0, h: 0 };
  if (photo) {
    const maxW = vp.w - (vp.w < 768 ? 24 : info ? 480 : 160);
    const maxH = vp.h - (vp.w < 768 ? 180 : 170);
    const ratio = photo.width / photo.height;
    box = maxW / maxH > ratio ? { w: maxH * ratio, h: maxH } : { w: maxW, h: maxW / ratio };
  }

  return createPortal(
    <AnimatePresence>
      {photo && (
        <motion.div key="lightbox" className="fixed inset-0 z-[70]" role="dialog" aria-modal aria-label={photo.title}>
          <motion.div
            className="absolute inset-0 bg-black/[0.96] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.1 } }}
            transition={{ duration: 0.6 }}
            onClick={onClose}
          />

          {/* Barra superior */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5 md:px-10">
            <motion.span custom={0} variants={controlsVariants} initial="hidden" animate="show" exit="hidden" className="eyebrow tabular-nums">
              {String(index + 1).padStart(2, "0")} / {String(total ?? photos.length).padStart(2, "0")}
            </motion.span>
            <motion.button
              custom={1} variants={controlsVariants} initial="hidden" animate="show" exit="hidden"
              onClick={onClose}
              className="pointer-events-auto eyebrow flex items-center gap-3 transition-colors hover:text-bone"
            >
              Cerrar
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.2}><path d="M5 5l14 14M19 5L5 19" /></svg>
            </motion.button>
          </div>

          {/* Foto */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-16 md:pb-10">
            <motion.div
              className="pointer-events-auto relative"
              animate={{ x: info && vp.w >= 768 ? -160 : 0 }}
              transition={{ duration: 0.7, ease: EASE_CINE }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={photo.id}
                  layoutId={photo.id === originId ? `photo-${photo.id}` : undefined}
                  className="relative overflow-hidden shadow-2xl shadow-black"
                  style={{ width: box.w, height: box.h }}
                  initial={photo.id === originId ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={photo.id === originId ? undefined : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.7, ease: EASE_CINE }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  {/* La versión optimizada grande aparece encima cuando termina de cargar */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.displayUrl}
                    alt={photo.title}
                    onLoad={() => setLoadedId(photo.id)}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${loadedId === photo.id ? "opacity-100" : "opacity-0"}`}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Flechas */}
          {photos.length > 1 && (
            <>
              {([-1, 1] as const).map((dir) => (
                <motion.button
                  key={dir}
                  custom={2} variants={controlsVariants} initial="hidden" animate="show" exit="hidden"
                  onClick={() => go(dir)}
                  aria-label={dir === 1 ? "Siguiente" : "Anterior"}
                  className={`group absolute top-1/2 hidden h-24 w-16 -translate-y-1/2 items-center justify-center text-bone/50 transition-colors hover:text-bone md:flex ${dir === 1 ? "right-4" : "left-4"}`}
                >
                  <svg viewBox="0 0 24 24" className={`h-6 w-6 transition-transform duration-500 ${dir === 1 ? "group-hover:translate-x-1" : "rotate-180 group-hover:-translate-x-1"}`} fill="none" stroke="currentColor" strokeWidth={1}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              ))}
            </>
          )}

          {/* Barra inferior: título y acciones */}
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 px-6 py-5 md:px-10">
            <motion.div custom={3} variants={controlsVariants} initial="hidden" animate="show" exit="hidden">
              <p className="font-display text-2xl font-light md:text-3xl">{photo.title}</p>
              <p className="eyebrow mt-1">{photo.category?.name ?? "Sin categoría"} · {formatDate(photo.takenAt)}</p>
            </motion.div>
            <motion.div custom={4} variants={controlsVariants} initial="hidden" animate="show" exit="hidden" className="flex items-center gap-6">
              <FavoriteButton photoId={photo.id} withLabel />
              <DownloadButton photoId={photo.id} downloadable={photo.downloadable} withLabel />
              <button onClick={() => setInfo((v) => !v)} className={`eyebrow transition-colors hover:text-bone ${info ? "text-bone!" : ""}`}>
                Info
              </button>
              <TLink href={`/foto/${photo.slug}`} onClick={onClose} className="eyebrow transition-colors hover:text-bone">
                Abrir ↗
              </TLink>
            </motion.div>
          </div>

          {/* Panel de información */}
          <AnimatePresence>
            {info && (
              <motion.aside
                className="absolute top-20 right-0 bottom-24 w-full max-w-xs overflow-y-auto border-l border-line bg-ink/80 px-8 py-6 backdrop-blur-xl md:right-6"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.6, ease: EASE_CINE }}
              >
                <PhotoInfo photo={photo} />
              </motion.aside>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function PhotoInfo({ photo }: { photo: PhotoDTO }) {
  const rows: [string, React.ReactNode][] = [
    ["Fecha", formatDate(photo.takenAt)],
    ["Categoría", photo.category?.name ?? "—"],
    ["Tema", photo.theme ?? "—"],
    ["Lugar", photo.location ?? "—"],
    ["Cámara", photo.camera ?? "—"],
    ["Resolución", `${photo.width} × ${photo.height} px · ${resolutionLabel(photo.width, photo.height)}`],
    ["Megapíxeles", megapixels(photo.width, photo.height)],
    ["Archivo original", formatBytes(photo.originalSize)],
  ];
  return (
    <div className="space-y-5 text-sm">
      {photo.description && <p className="leading-relaxed text-bone/80">{photo.description}</p>}
      <dl className="space-y-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6 border-b border-line pb-3">
            <dt className="eyebrow">{k}</dt>
            <dd className="text-right text-bone/90">{v}</dd>
          </div>
        ))}
      </dl>
      {photo.tags.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Etiquetas</p>
          <div className="flex flex-wrap gap-2">
            {photo.tags.map((t) => (
              <TLink key={t} href={`/galeria?etiqueta=${encodeURIComponent(t)}`} className="rounded-full border border-line px-3 py-1 text-xs text-bone/70 transition-colors hover:border-bone/40 hover:text-bone">
                {t}
              </TLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
