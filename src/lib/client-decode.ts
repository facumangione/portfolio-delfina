/*
 * Abre en el navegador cualquier formato de foto admitido (ver lib/uploads.ts)
 * para poder generar las versiones optimizadas.
 *
 *  1. Primero se intenta con el navegador (JPG, PNG, WebP, AVIF, GIF, BMP;
 *     Safari además abre TIFF y HEIC).
 *  2. Si no puede:
 *     - RAW: se busca la vista previa JPEG que la cámara guarda adentro del
 *       archivo (casi todas las cámaras guardan una grande) y se usa esa.
 *     - TIFF: se decodifica con UTIF.
 *     - HEIC/HEIF: se decodifica con libheif (heic-to).
 *     Los decodificadores pesados se cargan sólo si hacen falta.
 *
 * Devuelve la imagen y la rotación que falta aplicar (0, 90, 180 o 270 grados).
 */

import { FORMATS, extensionOf } from "./uploads";

export type Decoded = { source: ImageBitmap | HTMLCanvasElement; rotate: 0 | 90 | 180 | 270 };

const ROTATION: Record<number, 0 | 90 | 180 | 270> = { 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 };

export async function decodeImage(file: File): Promise<Decoded> {
  const kind = FORMATS[extensionOf(file.name)]?.kind ?? "web";

  // RAW: el navegador no los abre, vamos directo a la vista previa
  if (kind !== "raw") {
    try {
      // imageOrientation: aplica la rotación EXIF (fotos verticales de cámara)
      return { source: await createImageBitmap(file, { imageOrientation: "from-image" }), rotate: 0 };
    } catch {
      // seguimos con el decodificador específico
    }
  }

  if (kind === "raw") return decodeRaw(file);
  if (kind === "tiff") return decodeTiff(file);
  if (kind === "heic") {
    const { heicTo } = await import("heic-to/next");
    try {
      return { source: await heicTo({ blob: file, type: "bitmap" }), rotate: 0 };
    } catch {
      throw new Error("No se pudo abrir este HEIC");
    }
  }
  throw new Error("El navegador no pudo abrir esta imagen");
}

// ---- RAW ----

async function decodeRaw(file: File): Promise<Decoded> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const rawOrientation = tiffOrientation(bytes, 0);
  // Probamos las vistas previas de la más grande a la más chica
  for (const [start, end] of embeddedJpegs(bytes).sort((a, b) => b[1] - b[0] - (a[1] - a[0]))) {
    const jpeg = bytes.subarray(start, end);
    try {
      const source = await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }), { imageOrientation: "from-image" });
      // Si la vista previa no trae su propia orientación, usamos la del RAW
      const own = jpegOrientation(jpeg);
      return { source, rotate: own ? 0 : ROTATION[rawOrientation ?? 1] ?? 0 };
    } catch {
      // probamos con la siguiente
    }
  }
  // Último intento: algunos RAW basados en TIFF (DNG) se pueden decodificar con UTIF
  try {
    return await decodeTiff(file, bytes);
  } catch {
    throw new Error("Este RAW no trae una vista previa que se pueda usar");
  }
}

/**
 * Busca imágenes JPEG comunes (no las "lossless" con los datos del sensor,
 * que el navegador no puede abrir) adentro del archivo. Devuelve [inicio, fin].
 */
function embeddedJpegs(b: Uint8Array): [number, number][] {
  const found: [number, number][] = [];
  for (let i = 0; i < b.length - 3; i++) {
    if (b[i] !== 0xff || b[i + 1] !== 0xd8 || b[i + 2] !== 0xff) continue;
    const end = jpegEnd(b, i);
    if (end > 0) {
      if (end - i > 20_000) found.push([i, end]);
      i = end - 1;
    }
  }
  return found;
}

/** Recorre los segmentos de un JPEG y devuelve dónde termina, o -1 si no es un JPEG que el navegador abra. */
function jpegEnd(b: Uint8Array, start: number): number {
  let p = start + 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) return -1;
    const marker = b[p + 1];
    if (marker === 0xff) { p++; continue; }
    if (marker === 0xd9) return p + 2;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { p += 2; continue; }
    // SOF de JPEG "lossless" o aritmético: son los datos crudos del sensor
    if ([0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return -1;
    const length = (b[p + 2] << 8) | b[p + 3];
    if (length < 2) return -1;
    p += 2 + length;
    if (marker === 0xda) {
      // Datos de la imagen: avanzar hasta el próximo marcador real
      while (p + 1 < b.length && !(b[p] === 0xff && b[p + 1] !== 0 && !(b[p + 1] >= 0xd0 && b[p + 1] <= 0xd7))) p++;
    }
  }
  return -1;
}

/** Orientación EXIF (1-8) dentro del bloque APP1 de un JPEG, o null. */
function jpegOrientation(jpeg: Uint8Array): number | null {
  let p = 2;
  while (p + 4 < jpeg.length && jpeg[p] === 0xff) {
    const marker = jpeg[p + 1];
    const length = (jpeg[p + 2] << 8) | jpeg[p + 3];
    // APP1 "Exif\0\0" seguido de una cabecera TIFF
    if (marker === 0xe1 && String.fromCharCode(...jpeg.subarray(p + 4, p + 8)) === "Exif") {
      const o = tiffOrientation(jpeg, p + 10);
      return o && o !== 1 ? o : null;
    }
    if (marker === 0xda) break;
    p += 2 + length;
  }
  return null;
}

/** Lee la etiqueta Orientation (0x0112) del primer directorio de una cabecera TIFF. */
function tiffOrientation(b: Uint8Array, base: number): number | null {
  if (b.length < base + 8) return null;
  const little = b[base] === 0x49 && b[base + 1] === 0x49; // "II"
  const big = b[base] === 0x4d && b[base + 1] === 0x4d; // "MM"
  if (!little && !big) return null;
  const u16 = (o: number) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) => (little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 2 ** 24 : b[o] * 2 ** 24 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]));
  const ifd = base + u32(base + 4);
  if (ifd + 2 > b.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count && ifd + 2 + i * 12 + 12 <= b.length; i++) {
    const entry = ifd + 2 + i * 12;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return null;
}

// ---- TIFF ----

async function decodeTiff(file: File, bytes?: Uint8Array): Promise<Decoded> {
  const UTIF = (await import("utif2")).default;
  const buffer = bytes ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : await file.arrayBuffer();
  const ifds = UTIF.decode(buffer as ArrayBuffer);
  // La imagen principal es la más grande (las otras suelen ser miniaturas)
  const tag = (ifd: (typeof ifds)[number], name: string) => Number((ifd[name] as ArrayLike<number> | undefined)?.[0] ?? 0);
  const main = ifds.reduce((best, ifd) => (tag(ifd, "t256") * tag(ifd, "t257") > tag(best, "t256") * tag(best, "t257") ? ifd : best));
  UTIF.decodeImage(buffer as ArrayBuffer, main);
  const width = Number(main.width);
  const height = Number(main.height);
  if (!width || !height) throw new Error("No se pudo abrir este TIFF");
  const rgba = UTIF.toRGBA8(main);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  const orientation = tag(main, "t274") || 1;
  return { source: canvas, rotate: ROTATION[orientation] ?? 0 };
}
