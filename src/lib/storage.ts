import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Estructura en disco:
//   storage/originals/  -> archivos originales (privados, pueden pesar cientos de MB)
//   storage/display/    -> versión optimizada para ver en pantalla (webp ~2400px)
//   storage/thumbs/     -> miniatura para la galería (webp ~900px)
// Sólo display y thumbs se sirven públicamente (ruta /media/...).

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR ?? "./storage");

export const DIRS = {
  originals: path.join(STORAGE_DIR, "originals"),
  display: path.join(STORAGE_DIR, "display"),
  thumbs: path.join(STORAGE_DIR, "thumbs"),
  tmp: path.join(STORAGE_DIR, "tmp"),
} as const;

export type PublicVariant = "display" | "thumbs";

export async function ensureDirs() {
  await Promise.all(Object.values(DIRS).map((d) => fsp.mkdir(d, { recursive: true })));
}

/**
 * Guarda un stream (el cuerpo de la petición HTTP) directamente en disco,
 * sin cargar el archivo completo en memoria. Clave para originales de 8K.
 * Corta si se supera `maxBytes`.
 */
export async function saveStream(
  body: ReadableStream<Uint8Array>,
  destination: string,
  maxBytes: number,
): Promise<number> {
  let written = 0;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      written += chunk.byteLength;
      if (written > maxBytes) controller.error(new Error("FILE_TOO_LARGE"));
      else controller.enqueue(chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(body.pipeThrough(limiter) as import("node:stream/web").ReadableStream),
      fs.createWriteStream(destination),
    );
  } catch (err) {
    await fsp.rm(destination, { force: true });
    throw err;
  }
  return written;
}

/** Ruta absoluta a partir de la ruta relativa guardada en la base de datos. */
export function absolute(relativePath: string) {
  const full = path.resolve(STORAGE_DIR, relativePath);
  if (!full.startsWith(STORAGE_DIR + path.sep)) throw new Error("Ruta fuera del almacenamiento");
  return full;
}

export function relative(fullPath: string) {
  return path.relative(STORAGE_DIR, fullPath);
}

export async function removeFiles(...relativePaths: string[]) {
  await Promise.all(relativePaths.map((p) => fsp.rm(absolute(p), { force: true })));
}

/** Stream de lectura listo para devolver en una Response. */
export function fileStream(relativePath: string) {
  return Readable.toWeb(fs.createReadStream(absolute(relativePath))) as ReadableStream;
}

/** URL pública de una versión optimizada. */
export function publicUrl(relativePath: string) {
  return `/media/${relativePath.split(path.sep).join("/")}`;
}
