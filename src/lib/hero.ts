/*
 * Cómo se acomoda la foto de portada (hero) en la pantalla.
 *
 * El hero ocupa toda la ventana. Si la foto tiene una forma parecida a la de
 * la pantalla, la estiramos para llenarla ("cover", recortando un poco los
 * bordes). Pero una foto vertical en una pantalla ancha perdería más de la
 * mitad de la imagen y se agrandaría tanto que se vería pixelada. En ese caso
 * la mostramos ENTERA ("contain") sobre un fondo hecho con la misma foto muy
 * desenfocada y oscura, así la estética sigue siendo oscura y envolvente.
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

/** Punto de enfoque como "x% y%" (lo que entiende CSS object-position). Por defecto, el centro. */
export function parseHeroFocus(value: string): { x: number; y: number } {
  const m = /^(\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/.exec(value.trim());
  if (!m) return { x: 50, y: 50 };
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  return { x: clamp(Number(m[1])), y: clamp(Number(m[2])) };
}

export const focusToCss = (f: { x: number; y: number }) => `${Math.round(f.x)}% ${Math.round(f.y)}%`;

/** Medidas de la versión web que realmente se descarga (lado largo hasta 2400px). */
export function displaySize(width: number, height: number) {
  const ratio = Math.min(1, DISPLAY_MAX / Math.max(width, height));
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Con "cover", qué parte del lado recortado de la foto queda a la vista (1 = toda). */
const MIN_VISIBLE = 0.6;
/** Cuánto se puede agrandar la foto antes de que se note pixelada (1.6 = 160%). */
const MAX_UPSCALE = 1.6;

/**
 * Decide "cover" o "contain" para una foto de `photo` píxeles en una pantalla
 * de `screen` píxeles CSS. Con modo "auto":
 *   - si llenar la pantalla dejaría ver menos del 60% de la foto, o
 *   - si habría que agrandarla más de 1,6 veces (foto chica → pixelada),
 * se muestra entera. Si no, llena la pantalla como siempre.
 */
export function resolveHeroFit(
  fit: HeroFit,
  photo: { width: number; height: number },
  screen: { width: number; height: number },
): "cover" | "contain" {
  if (fit !== "auto") return fit;
  if (!photo.width || !photo.height || !screen.width || !screen.height) return "cover";
  const photoRatio = photo.width / photo.height;
  const screenRatio = screen.width / screen.height;
  const visible = Math.min(photoRatio / screenRatio, screenRatio / photoRatio);
  const shown = displaySize(photo.width, photo.height);
  const upscale = Math.max(screen.width / shown.width, screen.height / shown.height);
  return visible < MIN_VISIBLE || upscale > MAX_UPSCALE ? "contain" : "cover";
}
