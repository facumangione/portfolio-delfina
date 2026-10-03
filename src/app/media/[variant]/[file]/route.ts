import { readFile } from "@/lib/storage";

/*
 * Sirve las versiones OPTIMIZADAS (display y thumbs) cuando no hay una
 * dirección pública del bucket (S3_PUBLIC_URL) o en modo local. Son públicas y
 * su nombre incluye una versión, así que se pueden cachear "para siempre"
 * (también en la red de Vercel). Los originales NO se pueden pedir por acá.
 */
const ALLOWED = new Set(["display", "thumbs"]);
const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg" };

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string; file: string }> }) {
  const { variant, file } = await params;
  const ext = file.split(".").pop() ?? "";
  if (!ALLOWED.has(variant) || !/^[\w-]+\.(webp|jpg)$/.test(file)) return new Response("No encontrado", { status: 404 });
  const found = await readFile(`${variant}/${file}`);
  if (!found) return new Response("No encontrado", { status: 404 });
  return new Response(found.body, {
    headers: {
      "Content-Type": TYPES[ext],
      "Content-Length": String(found.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
