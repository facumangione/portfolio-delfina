/** Formatos de original que el navegador puede abrir para generar las versiones optimizadas. */
export const ORIGINAL_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

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
