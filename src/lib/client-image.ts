/*
 * Procesamiento de fotos EN EL NAVEGADOR de la fotógrafa, antes de subirlas.
 *
 * El servidor (Vercel) no puede abrir originales 8K de cientos de MB: tiene
 * poca memoria y tiempo por petición. La computadora de la fotógrafa sí, así
 * que acá generamos:
 *   - la versión para pantalla (lado largo 2400px),
 *   - la miniatura para la galería (900px),
 *   - un placeholder borroso diminuto (16px, en base64) que se ve mientras carga,
 * y leemos medidas y fecha de toma (EXIF). El original se sube tal cual.
 */

export const DISPLAY_MAX = 2400;
export const THUMB_MAX = 900;
/** Safari no deja crear canvas de más de ~16 millones de píxeles. */
const MAX_CANVAS_PIXELS = 12_000_000;

export interface PreparedImage {
  width: number;
  height: number;
  display: Blob;
  thumb: Blob;
  blurDataUrl: string;
  takenAt: string | null;
}

type Source = ImageBitmap | HTMLCanvasElement;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Reduce la imagen al lado largo `max`. Achica de a mitades (como hace un
 * programa de edición) para que el resultado quede nítido y sin "serrucho".
 */
function resize(src: Source, max: number): HTMLCanvasElement {
  const ratio = Math.min(1, max / Math.max(src.width, src.height));
  const targetW = Math.max(1, Math.round(src.width * ratio));
  const targetH = Math.max(1, Math.round(src.height * ratio));

  let current: Source = src;
  let w = src.width;
  let h = src.height;
  while (w / 2 >= targetW && h / 2 >= targetH) {
    let nw = Math.round(w / 2);
    let nh = Math.round(h / 2);
    if (nw * nh > MAX_CANVAS_PIXELS) {
      const k = Math.sqrt(MAX_CANVAS_PIXELS / (nw * nh));
      nw = Math.round(nw * k);
      nh = Math.round(nh * k);
    }
    current = draw(current, nw, nh);
    w = nw;
    h = nh;
  }
  return draw(current, targetW, targetH);
}

function draw(src: Source, w: number, h: number) {
  const c = canvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  if (src instanceof HTMLCanvasElement) src.width = src.height = 0; // libera memoria
  return c;
}

/** WebP si el navegador lo genera; si no (Safari viejo), JPG. */
function encode(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((webp) => {
      if (webp?.type === "image/webp") return resolve(webp);
      c.toBlob((jpg) => (jpg ? resolve(jpg) : reject(new Error("No se pudo generar la imagen"))), "image/jpeg", quality);
    }, "image/webp", quality);
  });
}

/** Busca la fecha "AAAA:MM:DD HH:MM:SS" en el bloque EXIF (DateTimeOriginal), al principio del archivo. */
async function exifDate(file: File): Promise<string | null> {
  const head = new TextDecoder("latin1").decode(await file.slice(0, 256 * 1024).arrayBuffer());
  // Suele haber varias; la última corresponde a DateTimeOriginal/Digitized
  const raw = head.match(/\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/g)?.at(-1);
  if (!raw) return null;
  const [d, t] = raw.split(" ");
  const date = new Date(`${d.replace(/:/g, "-")}T${t}Z`);
  return isNaN(date.getTime()) || date.getUTCFullYear() < 1900 ? null : date.toISOString();
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    // imageOrientation: aplica la rotación EXIF (fotos verticales de cámara)
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("El navegador no pudo abrir esta imagen");
  }
  const { width, height } = bitmap;
  const displayCanvas = resize(bitmap, DISPLAY_MAX);
  bitmap.close();

  const display = await encode(displayCanvas, 0.84);
  // La miniatura y el desenfoque salen de la versión de pantalla (mucho más rápido)
  const thumbCanvas = resize(displayCanvas, THUMB_MAX);
  const thumb = await encode(thumbCanvas, 0.76);
  const blurCanvas = resize(thumbCanvas, 16);
  const blurDataUrl = blurCanvas.toDataURL("image/webp", 0.4);
  blurCanvas.width = blurCanvas.height = 0;

  return { width, height, display, thumb, blurDataUrl, takenAt: await exifDate(file) };
}
