"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { PhotoDTO } from "@/lib/photos";
import { formatDate } from "@/lib/utils";
import { FavoriteButton } from "@/components/photo/FavoriteButton";
import { DownloadButton } from "@/components/photo/DownloadButton";
import { EASE_CINE } from "@/components/motion/easing";

/*
 * Tarjeta de la galería. Todo el hover se resuelve con CSS (clases group-hover)
 * porque es más liviano que animar con JavaScript:
 *  - zoom muy sutil y lento de la imagen,
 *  - degradado oscuro que aparece desde abajo,
 *  - título/categoría/fecha que suben con fade,
 *  - acciones (favorito, ver, descargar) que aparecen escalonadas.
 * La imagen lleva un layoutId para que, al abrirla, "vuele" hasta el visor.
 */
export function PhotoCard({ photo, onOpen, index }: { photo: PhotoDTO; onOpen: () => void; index: number }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      className="group relative h-full w-full"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 1, ease: EASE_CINE, delay: (index % 4) * 0.06 }}
    >
      <div
        role="button"
        tabIndex={0}
        data-cursor="Ver"
        onClick={onOpen}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
        className="relative h-full w-full overflow-hidden bg-smoke outline-none focus-visible:ring-1 focus-visible:ring-bone/60"
        style={{ backgroundImage: `url(${photo.blurDataUrl})`, backgroundSize: "cover" }}
      >
        <motion.div layoutId={`photo-${photo.id}`} className="absolute inset-0" transition={{ duration: 0.7, ease: EASE_CINE }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbUrl}
            alt={photo.title}
            loading={index < 6 ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover transition-[transform,opacity,filter] duration-[1400ms] ease-[var(--ease-cine)] group-hover:scale-[1.045] ${
              loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
            }`}
          />
        </motion.div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100 group-focus-within:opacity-100" />

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 md:p-6">
          <div className="translate-y-3 opacity-0 transition-all duration-700 ease-[var(--ease-cine)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <p className="eyebrow mb-1.5 text-bone/70!">
              {photo.category?.name ?? "Sin categoría"} · {formatDate(photo.takenAt, "short")}
            </p>
            <h3 className="font-display text-2xl leading-tight font-light text-bone">{photo.title}</h3>
            {photo.theme && <p className="mt-1 text-xs text-bone/60">{photo.theme}</p>}
          </div>
          <div className="flex items-center gap-4">
            {[
              <FavoriteButton key="f" photoId={photo.id} />,
              <button
                key="v"
                onClick={(e) => (e.stopPropagation(), onOpen())}
                aria-label="Ver en grande"
                className="text-bone"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.2}>
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              </button>,
              <DownloadButton key="d" photoId={photo.id} downloadable={photo.downloadable} />,
            ].map((el, i) => (
              <span
                key={i}
                className="flex translate-y-3 opacity-0 transition-all duration-500 ease-[var(--ease-cine)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                style={{ transitionDelay: `${80 + i * 70}ms` }}
              >
                {el}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
