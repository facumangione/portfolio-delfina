import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AwsClient } from "aws4fetch";

/*
 * Almacenamiento de las fotos. Cada archivo se identifica por una "clave":
 *   originals/<id>.<ext>        -> original (privado, puede pesar cientos de MB)
 *   display/<id>-<versión>.webp -> versión para ver en pantalla (~2400px)
 *   thumbs/<id>-<versión>.webp  -> miniatura para la galería (~900px)
 * Esas claves son las que se guardan en la base (originalPath, displayPath, thumbPath).
 *
 * Hay dos modos, con la misma interfaz:
 *  - "s3": un bucket compatible con S3 (en producción, Cloudflare R2). Se activa
 *    al definir S3_BUCKET. El navegador sube los archivos DIRECTO al bucket con
 *    URLs firmadas, así el servidor (Vercel) nunca recibe archivos pesados.
 *  - "local": una carpeta del disco (STORAGE_DIR). Para probar en la computadora.
 *    Las "URLs firmadas" apuntan a /api/upload/file, que guarda en disco.
 */

const S3 = process.env.S3_BUCKET
  ? {
      bucket: process.env.S3_BUCKET,
      endpoint: (process.env.S3_ENDPOINT ?? "").replace(/\/+$/, ""),
      publicUrl: (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, ""),
      client: new AwsClient({
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
        service: "s3",
        region: process.env.S3_REGION ?? "auto",
      }),
    }
  : null;

export const STORAGE_MODE: "s3" | "local" = S3 ? "s3" : "local";
export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR ?? "./storage");
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 2048) * 1024 * 1024;

/** Sólo se aceptan claves con esta forma (evita que alguien pida o pise otros archivos). */
const KEY_RE = /^(originals|display|thumbs)\/[\w-]+\.(jpg|jpeg|png|tif|webp|avif)$/;
export const isValidKey = (key: string) => KEY_RE.test(key);

function assertKey(key: string) {
  if (!isValidKey(key)) throw new Error(`Clave de archivo inválida: ${key}`);
}

const objectUrl = (key: string) => `${S3!.endpoint}/${S3!.bucket}/${key}`;

/** Ruta en disco de una clave (modo local). */
export function absolute(key: string) {
  assertKey(key);
  const full = path.resolve(STORAGE_DIR, key);
  if (!full.startsWith(STORAGE_DIR + path.sep)) throw new Error("Ruta fuera del almacenamiento");
  return full;
}

// ---- Firmas (para el modo local; el modo S3 usa las firmas del propio bucket) ----

function hmac(value: string) {
  return crypto.createHmac("sha256", process.env.AUTH_SECRET ?? "dev").update(value).digest("base64url");
}

/** Firma un objeto JSON en un texto "datos.firma" que no se puede alterar sin la clave. */
export function signToken(data: object) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function readToken<T>(token: string): T | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

// ---- Operaciones ----

/**
 * URL a la que el navegador puede hacer PUT del archivo durante `seconds` segundos.
 * El navegador debe mandar exactamente ese Content-Type.
 */
export async function signedUploadUrl(key: string, contentType: string, seconds = 3600) {
  assertKey(key);
  if (S3) {
    const url = new URL(objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(seconds));
    const signed = await S3.client.sign(url.toString(), {
      method: "PUT",
      headers: { "Content-Type": contentType },
      aws: { signQuery: true },
    });
    return signed.url;
  }
  const token = signToken({ key, type: contentType, exp: Date.now() + seconds * 1000 });
  return `/api/upload/file?token=${encodeURIComponent(token)}`;
}

/** URL temporal para descargar el original con su nombre (modo S3). En modo local devuelve null. */
export async function signedDownloadUrl(key: string, filename: string, seconds = 300) {
  assertKey(key);
  if (!S3) return null;
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(seconds));
  url.searchParams.set("response-content-disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
  const signed = await S3.client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
  return signed.url;
}

/** Tamaño en bytes del archivo, o null si no existe. */
export async function fileSize(key: string): Promise<number | null> {
  assertKey(key);
  if (S3) {
    const res = await S3.client.fetch(objectUrl(key), { method: "HEAD" });
    if (!res.ok) return null;
    return Number(res.headers.get("content-length") ?? 0);
  }
  try {
    return (await fsp.stat(absolute(key))).size;
  } catch {
    return null;
  }
}

/** Contenido del archivo como stream (para servirlo o descargarlo), o null si no existe. */
export async function readFile(key: string): Promise<{ body: ReadableStream; size: number } | null> {
  assertKey(key);
  if (S3) {
    const res = await S3.client.fetch(objectUrl(key));
    if (!res.ok || !res.body) return null;
    return { body: res.body, size: Number(res.headers.get("content-length") ?? 0) };
  }
  const size = await fileSize(key);
  if (size === null) return null;
  return { body: Readable.toWeb(fs.createReadStream(absolute(key))) as ReadableStream, size };
}

/** Guarda un archivo completo (lo usan los scripts de ejemplo). */
export async function writeFile(key: string, data: Buffer, contentType: string) {
  assertKey(key);
  if (S3) {
    const res = await S3.client.fetch(objectUrl(key), { method: "PUT", body: new Uint8Array(data), headers: { "Content-Type": contentType } });
    if (!res.ok) throw new Error(`No se pudo guardar ${key}: ${res.status} ${await res.text()}`);
    return;
  }
  await fsp.mkdir(path.dirname(absolute(key)), { recursive: true });
  await fsp.writeFile(absolute(key), data);
}

export async function removeFiles(...keys: string[]) {
  await Promise.all(
    keys.filter(isValidKey).map(async (key) => {
      if (S3) await S3.client.fetch(objectUrl(key), { method: "DELETE" });
      else await fsp.rm(absolute(key), { force: true });
    }),
  );
}

/**
 * Modo local: guarda en disco el cuerpo de un PUT a medida que llega, sin
 * cargarlo entero en memoria. Corta si supera `maxBytes`.
 */
export async function saveStream(body: ReadableStream<Uint8Array>, key: string, maxBytes: number): Promise<number> {
  const destination = absolute(key);
  await fsp.mkdir(path.dirname(destination), { recursive: true });
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

/**
 * URL pública de una versión optimizada. Con S3_PUBLIC_URL se sirve directo
 * desde el bucket (sin pasar por el servidor); si no, por la ruta /media.
 */
export function publicUrl(key: string) {
  return S3?.publicUrl ? `${S3.publicUrl}/${key}` : `/media/${key}`;
}
