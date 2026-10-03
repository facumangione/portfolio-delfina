import crypto from "node:crypto";
import sharp from "sharp";

/*
 * Versión "servidor" del procesamiento de fotos, sólo para los scripts de
 * ejemplo (seed). En el sitio, las versiones optimizadas las genera el
 * navegador de la fotógrafa al subir (src/lib/client-image.ts), con las mismas
 * medidas: pantalla 2400px, miniatura 900px y desenfoque de 16px.
 */
sharp.cache(false);

export interface ProcessedImage {
  width: number;
  height: number;
  display: Buffer;
  thumb: Buffer;
  blurDataUrl: string;
  /** Sufijo de versión para los nombres de archivo (permite cachear para siempre). */
  version: string;
}

export async function processImage(original: Buffer): Promise<ProcessedImage> {
  const open = () => sharp(original, { limitInputPixels: false, failOn: "none" }).rotate();
  const meta = await open().metadata();
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;
  if (!width || !height) throw new Error("No se pudo leer la imagen");

  const display = await open().resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  const thumb = await sharp(display).resize(900, 900, { fit: "inside", withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  const blur = await sharp(thumb).resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();

  return {
    width,
    height,
    display,
    thumb,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    version: crypto.randomBytes(4).toString("hex"),
  };
}
