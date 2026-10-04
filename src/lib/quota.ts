import { db } from "./db";

/*
 * Espacio usado en el almacenamiento (Cloudflare R2).
 *
 * R2 es gratis hasta 10 GB; pasado eso cobra por GB. Para no llevarse
 * sorpresas, el sitio lleva la cuenta de lo que subió (la base guarda el
 * tamaño real de cada archivo, medido en el bucket al terminar la subida) y
 * deja de aceptar fotos nuevas al llegar al límite.
 *
 * Para hacer lugar sin perder fotos del sitio está "Archivar original"
 * (Estudio → Fotografías): borra del bucket sólo el original, que es casi
 * todo el peso, y la foto sigue publicada con sus versiones web.
 *
 * El límite se puede cambiar con STORAGE_LIMIT_GB (por ejemplo, si se pasa a
 * un plan pago y se acepta pagar el excedente).
 */

export const STORAGE_LIMIT_BYTES = Number(process.env.STORAGE_LIMIT_GB ?? 10) * 1024 ** 3;
/** A partir de qué porcentaje se avisa que queda poco espacio. */
export const STORAGE_WARN_RATIO = 0.8;

export async function storageUsage() {
  const [web, kept] = await Promise.all([
    db.photo.aggregate({ _sum: { displaySize: true, thumbSize: true } }),
    // Los originales archivados ya no están en el bucket: no cuentan
    db.photo.aggregate({ where: { originalArchivedAt: null }, _sum: { originalSize: true } }),
  ]);
  const originals = kept._sum.originalSize ?? 0;
  const optimized = (web._sum.displaySize ?? 0) + (web._sum.thumbSize ?? 0);
  const used = originals + optimized;
  return {
    originals,
    optimized,
    used,
    limit: STORAGE_LIMIT_BYTES,
    free: Math.max(0, STORAGE_LIMIT_BYTES - used),
    ratio: STORAGE_LIMIT_BYTES > 0 ? used / STORAGE_LIMIT_BYTES : 0,
  };
}
