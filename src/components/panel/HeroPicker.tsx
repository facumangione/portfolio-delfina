"use client";

import { useState } from "react";
import { focusToCss, parseHeroFocus, resolveHeroFit, type HeroFit } from "@/lib/hero";
import { Label } from "./ui";

/*
 * Elegir la foto de portada, cómo se acomoda y su punto de enfoque, viendo
 * en miniatura cómo va a quedar en una computadora y en un celular.
 * La decisión "llenar / mostrar entera" es la misma que usa el hero (lib/hero.ts).
 */

export interface HeroCandidate {
  id: string;
  title: string;
  thumbUrl: string;
  blurDataUrl: string;
  width: number;
  height: number;
}

const FIT_OPTIONS: { value: HeroFit; label: string; note: string }[] = [
  { value: "auto", label: "Automático", note: "Llena la pantalla si la foto lo permite; si no (vertical o chica), la muestra entera" },
  { value: "cover", label: "Llenar pantalla", note: "Siempre a pantalla completa, recortando lo que no entra" },
  { value: "contain", label: "Foto entera", note: "Siempre entera, sobre un fondo desenfocado de la misma foto" },
];

// Pantallas de referencia para las vistas previas
const SCREENS = [
  { label: "Computadora", width: 1920, height: 1080, previewWidth: 320 },
  { label: "Celular", width: 390, height: 844, previewWidth: 110 },
];

export function HeroPicker({
  photos, heroPhotoId, heroFit, heroFocus,
}: { photos: HeroCandidate[]; heroPhotoId: string; heroFit: HeroFit; heroFocus: string }) {
  const [photoId, setPhotoId] = useState(heroPhotoId);
  const [fit, setFit] = useState<HeroFit>(heroFit);
  const [focus, setFocus] = useState(parseHeroFocus(heroFocus));
  // "Automática" usa la primera destacada: la primera de la lista (vienen ordenadas así)
  const current = photos.find((p) => p.id === photoId) ?? photos[0];

  const choosePhoto = (id: string) => {
    setPhotoId(id);
    setFocus({ x: 50, y: 50 }); // otra foto: el enfoque vuelve al centro
  };

  const pickFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setFocus({ x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 });
  };

  return (
    <div className="space-y-10">
      <fieldset>
        <Label className="mb-4">Fotografía de portada (destacadas y más recientes; para otra, marcala como destacada)</Label>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          <label className="relative flex aspect-square cursor-pointer items-center justify-center border border-line text-center text-xs text-mist has-[:checked]:border-bone has-[:checked]:text-bone">
            <input type="radio" name="heroPhotoId" value="" checked={photoId === ""} onChange={() => choosePhoto("")} className="sr-only" />
            Automática<br />(primera destacada)
          </label>
          {photos.map((p) => (
            <label key={p.id} className="group relative aspect-square cursor-pointer overflow-hidden bg-smoke ring-offset-2 ring-offset-ink has-[:checked]:ring-1 has-[:checked]:ring-bone">
              <input type="radio" name="heroPhotoId" value={p.id} checked={photoId === p.id} onChange={() => choosePhoto(p.id)} className="sr-only" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbUrl} alt={p.title} loading="lazy" className="h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-100 group-has-[:checked]:opacity-100" />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <Label className="mb-4">Cómo se acomoda en la pantalla</Label>
        <div className="grid gap-3 md:grid-cols-3">
          {FIT_OPTIONS.map((o) => (
            <label key={o.value} className="cursor-pointer border border-line p-4 transition-colors has-[:checked]:border-bone">
              <input type="radio" name="heroFit" value={o.value} checked={fit === o.value} onChange={() => setFit(o.value)} className="sr-only" />
              <span className="block text-sm text-bone">{o.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-mist">{o.note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {current && (
        <div className="flex flex-wrap items-start gap-10">
          <div>
            <Label className="mb-4">Punto de enfoque (tocá la foto)</Label>
            <input type="hidden" name="heroFocus" value={focusToCss(focus)} />
            <button
              type="button"
              onClick={pickFocus}
              className="relative block cursor-crosshair overflow-hidden bg-smoke"
              style={{ width: current.width >= current.height ? 260 : 170, aspectRatio: `${current.width} / ${current.height}` }}
              title="Lo que toques queda siempre a la vista cuando la foto se recorta"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.thumbUrl} alt={current.title} className="h-full w-full object-cover" />
              <span
                className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
                style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
              />
            </button>
          </div>

          <div>
            <Label className="mb-4">Así se va a ver</Label>
            <div className="flex items-end gap-6">
              {SCREENS.map((s) => (
                <figure key={s.label}>
                  <Preview photo={current} fit={fit} focus={focusToCss(focus)} screen={s} />
                  <figcaption className="eyebrow mt-2">
                    {s.label} · {resolveHeroFit(fit, current, s) === "cover" ? "llena" : "entera"}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Miniatura del hero: la misma disposición que components/home/Hero.tsx, a escala. */
function Preview({
  photo, fit, focus, screen,
}: { photo: HeroCandidate; fit: HeroFit; focus: string; screen: (typeof SCREENS)[number] }) {
  const mode = resolveHeroFit(fit, photo, screen);
  const desktop = screen.width >= 768;
  const vertical = photo.height >= photo.width;
  // Mismos márgenes que el hero, como porcentaje de la pantalla de referencia
  const box = !desktop
    ? { left: "6%", right: "6%", top: "11%", bottom: "46%" }
    : vertical
      ? { left: "42%", right: "3.3%", top: "8.9%", bottom: "18%" }
      : { left: "3.3%", right: "3.3%", top: "8.9%", bottom: "38%" };

  return (
    <div
      className="relative overflow-hidden border border-line bg-ink"
      style={{ width: screen.previewWidth, aspectRatio: `${screen.width} / ${screen.height}` }}
    >
      {mode === "cover" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: focus }} />
      ) : (
        <>
          <div
            className="absolute -inset-[10%]"
            style={{ backgroundImage: `url(${photo.blurDataUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(10px) brightness(0.6) saturate(1.2)" }}
          />
          <div className={`absolute flex items-center ${desktop && vertical ? "justify-end" : "justify-center"}`} style={box}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.thumbUrl} alt="" className="max-h-full max-w-full object-contain shadow-lg" />
          </div>
        </>
      )}
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />
      <span className="absolute bottom-[12%] left-[6%] font-display text-bone" style={{ fontSize: screen.previewWidth / (desktop ? 9 : 5) }}>
        Delfina
      </span>
    </div>
  );
}
