/*
 * Punto de enfoque calculado EN EL NAVEGADOR (ver lib/focus.ts para el cálculo).
 * Lo usan la subida de fotos (lib/client-image.ts) y el panel de Contenido,
 * que calcula el de las fotos que se subieron antes de que existiera esto.
 */

import { detectFocus, FOCUS_SAMPLE, type Focus } from "./focus";

/** Dibuja la imagen en chico (sin tocar la original) y calcula su punto de enfoque. */
export function focusFromSource(source: CanvasImageSource, width: number, height: number): Focus {
  const ratio = Math.min(1, FOCUS_SAMPLE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * ratio));
  const h = Math.max(1, Math.round(height * ratio));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const focus = detectFocus(ctx.getImageData(0, 0, w, h).data, w, h);
  c.width = c.height = 0;
  return focus;
}

/**
 * Descarga una imagen (tiene que ser del mismo sitio, por ejemplo /media/thumbs/…,
 * porque el navegador no deja leer los píxeles de imágenes de otros dominios)
 * y calcula su punto de enfoque.
 */
export function focusFromUrl(url: string): Promise<Focus> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        resolve(focusFromSource(img, img.naturalWidth, img.naturalHeight));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`No se pudo abrir ${url}`));
    img.src = url;
  });
}
