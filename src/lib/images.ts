import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { DIRS, relative } from "./storage";

// Sin límite de píxeles: los originales pueden ser de 8K o más.
sharp.cache(false);
const open = (file: string) => sharp(file, { limitInputPixels: false, failOn: "none" }).rotate();

export const DISPLAY_MAX = 2400; // lado largo de la versión para pantalla
export const THUMB_MAX = 900; // lado largo de la miniatura de galería

export interface ProcessedImage {
  width: number;
  height: number;
  displayPath: string;
  displaySize: number;
  thumbPath: string;
  blurDataUrl: string;
}

/**
 * Pipeline de procesamiento de una foto ya guardada en disco:
 *  1. Lee dimensiones reales (respetando la orientación EXIF).
 *  2. Genera la versión "display" (webp, 2400px) para la vista ampliada.
 *  3. Genera la miniatura (webp, 900px) para la galería.
 *  4. Genera un placeholder borroso diminuto (base64) que se muestra mientras carga.
 * El original NO se toca: queda intacto para la descarga.
 */
export async function processImage(originalFullPath: string, id: string): Promise<ProcessedImage> {
  const meta = await open(originalFullPath).metadata();
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;
  if (!width || !height) throw new Error("No se pudo leer la imagen");

  // El hash en el nombre permite cachear para siempre: si se reprocesa, cambia la URL.
  const version = crypto.randomBytes(4).toString("hex");
  const displayFull = path.join(DIRS.display, `${id}-${version}.webp`);
  const thumbFull = path.join(DIRS.thumbs, `${id}-${version}.webp`);

  await open(originalFullPath)
    .resize(DISPLAY_MAX, DISPLAY_MAX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(displayFull);

  // La miniatura sale de la versión display (mucho más rápido que volver al original)
  await sharp(displayFull)
    .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76 })
    .toFile(thumbFull);

  const blur = await sharp(thumbFull).resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();

  return {
    width,
    height,
    displayPath: relative(displayFull),
    displaySize: (await fsp.stat(displayFull)).size,
    thumbPath: relative(thumbFull),
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
  };
}
