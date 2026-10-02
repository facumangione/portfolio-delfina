import path from "node:path";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { DIRS, ensureDirs, relative, saveStream } from "@/lib/storage";
import { processImage } from "@/lib/images";
import { slugify } from "@/lib/utils";
import { uniqueSlug } from "@/lib/photos";

/*
 * Subida de fotografías de muy alta resolución.
 *
 * El navegador envía el archivo "crudo" como cuerpo de la petición (no como
 * multipart/form-data). Así podemos escribirlo en disco a medida que llega,
 * en trozos, sin tener nunca el archivo entero en memoria. Esto permite subir
 * originales 8K de cientos de MB.
 *
 * Después:
 *   1. se generan las versiones optimizadas con sharp,
 *   2. se crea la foto como BORRADOR (no publicada),
 *   3. la fotógrafa completa título, categoría, etiquetas… y la publica.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 2048) * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/tiff": "tif",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "photos.manage")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const mime = req.headers.get("content-type")?.split(";")[0] ?? "";
  const ext = TYPES[mime];
  if (!ext) return NextResponse.json({ error: "Formato no admitido (JPG, PNG, TIFF, WebP o AVIF)." }, { status: 415 });
  if (!req.body) return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });

  const originalName = decodeURIComponent(req.headers.get("x-filename") ?? `foto.${ext}`).slice(0, 200);
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  await ensureDirs();
  const originalFull = path.join(DIRS.originals, `${id}.${ext}`);

  let size: number;
  try {
    size = await saveStream(req.body, originalFull, MAX_BYTES);
  } catch (e) {
    const tooLarge = e instanceof Error && e.message === "FILE_TOO_LARGE";
    return NextResponse.json({ error: tooLarge ? "El archivo supera el máximo permitido." : "La subida se interrumpió." }, { status: tooLarge ? 413 : 400 });
  }

  try {
    const processed = await processImage(originalFull, id);
    const title = originalName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Sin título";
    const photo = await db.photo.create({
      data: {
        id,
        title,
        slug: await uniqueSlug(slugify(title)),
        originalPath: relative(originalFull),
        originalName,
        originalMime: mime,
        originalSize: size,
        published: false,
        uploadedById: user.id,
        ...processed,
      },
    });
    return NextResponse.json({ id: photo.id, title: photo.title, width: photo.width, height: photo.height, size });
  } catch {
    await fsp.rm(originalFull, { force: true });
    return NextResponse.json({ error: "No se pudo procesar la imagen." }, { status: 422 });
  }
}
