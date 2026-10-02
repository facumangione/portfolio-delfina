"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { PhotoDTO } from "@/lib/photos";
import { formatDate, resolutionLabel } from "@/lib/utils";
import { FavoriteButton } from "./FavoriteButton";
import { DownloadButton } from "./DownloadButton";
import { PhotoInfo } from "@/components/gallery/Lightbox";
import { TLink } from "@/components/motion/PageTransition";
import { Reveal } from "@/components/motion/Reveal";
import { EASE_CINE } from "@/components/motion/easing";

/*
 * Página individual. La foto ocupa casi toda la altura de la ventana y aparece
 * con un leve zoom out; la información está debajo, en texto pequeño, y los
 * detalles técnicos se despliegan sólo si el usuario los pide.
 */
export function PhotoView({
  photo, prev, next, related,
}: { photo: PhotoDTO; prev: { slug: string; title: string }; next: { slug: string; title: string }; related: PhotoDTO[] }) {
  const [loaded, setLoaded] = useState(false);
  const [details, setDetails] = useState(false);

  return (
    <article className="px-4 pt-24 pb-24 md:px-10">
      <div className="flex h-[calc(100svh-9rem)] min-h-[420px] items-center justify-center">
        <motion.div
          className="relative max-h-full max-w-full overflow-hidden"
          style={{ aspectRatio: `${photo.width} / ${photo.height}`, height: "100%", backgroundImage: `url(${photo.blurDataUrl})`, backgroundSize: "cover" }}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: EASE_CINE }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.displayUrl}
            alt={photo.title}
            onLoad={() => setLoaded(true)}
            ref={(el) => { if (el?.complete) setLoaded(true); }}
            className={`h-full w-full object-contain transition-opacity duration-1000 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </motion.div>
      </div>

      <motion.div
        className="mx-auto mt-8 flex max-w-6xl flex-col gap-6 md:flex-row md:items-end md:justify-between"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5, ease: EASE_CINE }}
      >
        <div>
          <h1 className="font-display text-4xl font-light md:text-5xl">{photo.title}</h1>
          <p className="eyebrow mt-3 flex flex-wrap gap-x-3 gap-y-1">
            <span>{formatDate(photo.takenAt)}</span>
            {photo.category && (
              <TLink href={`/galeria?categoria=${photo.category.slug}`} className="transition-colors hover:text-bone">· {photo.category.name}</TLink>
            )}
            {photo.theme && <span>· {photo.theme}</span>}
            <span>· {photo.width}×{photo.height} {resolutionLabel(photo.width, photo.height)}</span>
          </p>
          {photo.tags.length > 0 && (
            <p className="mt-3 flex flex-wrap gap-3 text-xs text-mist">
              {photo.tags.map((t) => (
                <TLink key={t} href={`/galeria?etiqueta=${encodeURIComponent(t)}`} className="transition-colors hover:text-bone">#{t}</TLink>
              ))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-7">
          <FavoriteButton photoId={photo.id} withLabel />
          <DownloadButton photoId={photo.id} downloadable={photo.downloadable} size={photo.originalSize} withLabel />
          <button onClick={() => setDetails((d) => !d)} className="eyebrow transition-colors hover:text-bone">
            {details ? "Ocultar" : "Detalles"}
          </button>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {details && (
          <motion.div
            className="mx-auto max-w-6xl overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_CINE }}
          >
            <div className="mt-8 max-w-md border-t border-line pt-8">
              <PhotoInfo photo={photo} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="mx-auto mt-20 flex max-w-6xl justify-between border-t border-line pt-6">
        <TLink href={`/foto/${prev.slug}`} className="group max-w-[45%]">
          <span className="eyebrow block">← Anterior</span>
          <span className="mt-1 block truncate font-display text-xl text-bone/60 transition-colors group-hover:text-bone">{prev.title}</span>
        </TLink>
        <TLink href={`/foto/${next.slug}`} className="group max-w-[45%] text-right">
          <span className="eyebrow block">Siguiente →</span>
          <span className="mt-1 block truncate font-display text-xl text-bone/60 transition-colors group-hover:text-bone">{next.title}</span>
        </TLink>
      </nav>

      {related.length > 0 && (
        <section className="mx-auto mt-32 max-w-6xl">
          <Reveal><p className="eyebrow mb-8">Más de {photo.category?.name}</p></Reveal>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {related.map((r, i) => (
              <Reveal key={r.id} delay={i * 0.08}>
                <TLink href={`/foto/${r.slug}`} data-cursor="Ver" className="group block aspect-[4/5] overflow-hidden bg-smoke">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumbUrl} alt={r.title} loading="lazy" className="h-full w-full object-cover opacity-80 transition-all duration-[1400ms] ease-[var(--ease-cine)] group-hover:scale-105 group-hover:opacity-100" />
                </TLink>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
