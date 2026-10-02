import fs from "node:fs/promises";
import { absolute, fileStream } from "@/lib/storage";

/*
 * Sirve las versiones OPTIMIZADAS (display y thumbs). Son públicas y su nombre
 * incluye un hash de versión, así que el navegador puede cachearlas "para siempre".
 * Los originales NO se pueden pedir por esta ruta.
 */
const ALLOWED = new Set(["display", "thumbs"]);

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string; file: string }> }) {
  const { variant, file } = await params;
  if (!ALLOWED.has(variant) || !/^[\w-]+\.webp$/.test(file)) return new Response("No encontrado", { status: 404 });
  const rel = `${variant}/${file}`;
  try {
    const { size } = await fs.stat(absolute(rel));
    return new Response(fileStream(rel), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
