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

/*
 * Cola de procesamiento: procesar un original 8K usa mucha memoria y CPU.
 * Si la fotógrafa sube 200 fotos, no queremos procesarlas todas a la vez y
 * tumbar el servidor: como máximo se procesan IMAGE_CONCURRENCY en paralelo
 * y el resto espera su turno.
 */
const MAX_PARALLEL = Number(process.env.IMAGE_CONCURRENCY ?? 2);
let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

export interface ProcessedImage {
  width: number;
  height: number;
  displayPath: string;
  displaySize: number;
  thumbPath: string;
  blurDataUrl: string;
  /** Fecha de la toma leída de los datos EXIF de la cámara, si existe. */
  takenAt: Date | null;
}

/** Busca la fecha "AAAA:MM:DD HH:MM:SS" dentro del bloque EXIF (DateTimeOriginal). */
function exifDate(exif: Buffer | undefined): Date | null {
  if (!exif) return null;
  const matches = exif.toString("latin1").match(/\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/g);
  // Suele haber varias; la última corresponde a DateTimeOriginal/Digitized
  const raw = matches?.at(-1);
  if (!raw) return null;
  const [d, t] = raw.split(" ");
  const date = new Date(`${d.replace(/:/g, "-")}T${t}Z`);
  return isNaN(date.getTime()) || date.getUTCFullYear() < 1900 ? null : date;
}

/**
 * Pipeline de procesamiento de una foto ya guardada en disco:
 *  1. Lee dimensiones reales (respetando la orientación EXIF) y la fecha de toma.
 *  2. Genera la versión "display" (webp, 2400px) para la vista ampliada.
 *  3. Genera la miniatura (webp, 900px) para la galería.
 *  4. Genera un placeholder borroso diminuto (base64) que se muestra mientras carga.
 * El original NO se toca: queda intacto para la descarga.
 */
export function processImage(originalFullPath: string, id: string): Promise<ProcessedImage> {
  return withSlot(async () => {
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
      takenAt: exifDate(meta.exif),
    };
  });
}
