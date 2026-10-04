/*
 * Formatos de original admitidos, por extensión del archivo.
 *
 * kind dice cómo los abre el navegador para generar las versiones optimizadas
 * (ver lib/client-image.ts):
 *   web  -> el navegador los abre directamente (JPG, PNG, WebP, AVIF, GIF, BMP)
 *   tiff -> con un decodificador de TIFF (Safari los abre solo)
 *   heic -> con un decodificador de HEIC/HEIF (fotos de iPhone)
 *   raw  -> archivos RAW de cámara: se usa la vista previa JPEG que la cámara
 *           guarda adentro del RAW (normalmente de tamaño completo o casi)
 *
 * El original se guarda SIEMPRE tal cual, sin convertir.
 */
export const FORMATS: Record<string, { mime: string; kind: "web" | "tiff" | "heic" | "raw" }> = {
  jpg: { mime: "image/jpeg", kind: "web" },
  jpeg: { mime: "image/jpeg", kind: "web" },
  png: { mime: "image/png", kind: "web" },
  webp: { mime: "image/webp", kind: "web" },
  avif: { mime: "image/avif", kind: "web" },
  gif: { mime: "image/gif", kind: "web" },
  bmp: { mime: "image/bmp", kind: "web" },
  tif: { mime: "image/tiff", kind: "tiff" },
  tiff: { mime: "image/tiff", kind: "tiff" },
  heic: { mime: "image/heic", kind: "heic" },
  heif: { mime: "image/heif", kind: "heic" },
  dng: { mime: "image/x-adobe-dng", kind: "raw" },
  cr2: { mime: "image/x-canon-cr2", kind: "raw" },
  cr3: { mime: "image/x-canon-cr3", kind: "raw" },
  crw: { mime: "image/x-canon-crw", kind: "raw" },
  nef: { mime: "image/x-nikon-nef", kind: "raw" },
  nrw: { mime: "image/x-nikon-nrw", kind: "raw" },
  arw: { mime: "image/x-sony-arw", kind: "raw" },
  srf: { mime: "image/x-sony-srf", kind: "raw" },
  sr2: { mime: "image/x-sony-sr2", kind: "raw" },
  raf: { mime: "image/x-fuji-raf", kind: "raw" },
  orf: { mime: "image/x-olympus-orf", kind: "raw" },
  rw2: { mime: "image/x-panasonic-rw2", kind: "raw" },
  pef: { mime: "image/x-pentax-pef", kind: "raw" },
  srw: { mime: "image/x-samsung-srw", kind: "raw" },
  rwl: { mime: "image/x-leica-rwl", kind: "raw" },
  "3fr": { mime: "image/x-hasselblad-3fr", kind: "raw" },
  fff: { mime: "image/x-hasselblad-fff", kind: "raw" },
  iiq: { mime: "image/x-phaseone-iiq", kind: "raw" },
  x3f: { mime: "image/x-sigma-x3f", kind: "raw" },
  erf: { mime: "image/x-epson-erf", kind: "raw" },
  mrw: { mime: "image/x-minolta-mrw", kind: "raw" },
  kdc: { mime: "image/x-kodak-kdc", kind: "raw" },
};

/** Extensión en minúsculas de un nombre de archivo ("IMG_01.CR2" -> "cr2"). */
export const extensionOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** Para el selector de archivos: imágenes comunes + todas las extensiones de arriba. */
export const ACCEPT_ATTRIBUTE = ["image/*", ...Object.keys(FORMATS).map((e) => `.${e}`)].join(",");

/** Formatos de las versiones optimizadas (webp; jpg en navegadores que no generan webp). */
export const OPTIMIZED_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg" };

/** Lo que /api/upload/start autoriza a subir y /api/upload/complete acepta. Viaja firmado. */
export interface UploadTicket {
  id: string;
  uid: string;
  name: string;
  mime: string;
  keys: { original: string; display: string; thumb: string };
  exp: number;
}
