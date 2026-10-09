/*
 * Cómo se acomoda la foto de portada (hero) en la pantalla.
 *
 * El hero ocupa toda la ventana. Normalmente estiramos la foto para llenarla
 * ("cover"), recortando lo que no entra. Qué parte queda a la vista lo decide
 * el PUNTO DE ENFOQUE: en una vertical en pantalla ancha sólo entra una franja,
 * y el punto elegido (por ejemplo, un ojo) queda dentro de esa franja.
 * Sólo si la foto es tan chica que se vería muy pixelada la mostramos ENTERA
 * ("contain") sobre un fondo hecho con la misma foto muy desenfocada y oscura.
 *
 * El punto de enfoque de cada foto se detecta solo (lib/focus.ts).
 *
 * Esta lógica la usan el hero (components/home/Hero.tsx) y la vista previa del
 * panel de Contenido (components/panel/HeroPicker.tsx), así se ven igual.
 */

/** Lado largo de la versión web (el mismo DISPLAY_MAX de lib/client-image.ts; no lo
 * importamos para no sumar el código de procesar fotos a la portada). */
const DISPLAY_MAX = 2400;

/** "auto" decide según la foto; "cover" llena siempre; "contain" muestra siempre la foto entera. */
export const HERO_FITS = ["auto", "cover", "contain"] as const;
export type HeroFit = (typeof HERO_FITS)[number];

export function parseHeroFit(value: string): HeroFit {
  return (HERO_FITS as readonly string[]).includes(value) ? (value as HeroFit) : "auto";
}

/** Medidas de la versión web que realmente se descarga (lado largo hasta 2400px). */
export function displaySize(width: number, height: number) {
  const ratio = Math.min(1, DISPLAY_MAX / Math.max(width, height));
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Cuánto se puede agrandar la foto antes de que se vea muy pixelada (2.5 = 250%). */
const MAX_UPSCALE = 2.5;

/**
 * Decide "cover" o "contain" para una foto de `photo` píxeles en una pantalla
 * de `screen` píxeles CSS. Con modo "auto" llena la pantalla, salvo que haya
 * que agrandar la foto más de 2,5 veces (foto muy chica → muy pixelada): ahí
 * se muestra entera.
 */
export function resolveHeroFit(
  fit: HeroFit,
  photo: { width: number; height: number },
  screen: { width: number; height: number },
): "cover" | "contain" {
  if (fit !== "auto") return fit;
  if (!photo.width || !photo.height || !screen.width || !screen.height) return "cover";
  const shown = displaySize(photo.width, photo.height);
  const upscale = Math.max(screen.width / shown.width, screen.height / shown.height);
  return upscale > MAX_UPSCALE ? "contain" : "cover";
}
