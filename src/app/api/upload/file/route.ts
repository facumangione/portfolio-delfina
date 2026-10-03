import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES, STORAGE_MODE, readToken, saveStream } from "@/lib/storage";

/*
 * Sólo para el modo local (sin bucket): recibe el PUT del navegador y lo
 * guarda en disco, igual que lo haría el bucket con una URL firmada.
 * El token lo generó /api/upload/start y dice qué archivo y de qué tipo.
 */
export async function PUT(req: Request) {
  if (STORAGE_MODE !== "local") return NextResponse.json({ error: "No disponible" }, { status: 404 });
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const data = readToken<{ key: string; type: string; exp: number }>(token);
  if (!data || data.exp < Date.now()) return NextResponse.json({ error: "Enlace vencido" }, { status: 403 });
  if (req.headers.get("content-type")?.split(";")[0] !== data.type) return NextResponse.json({ error: "Tipo de archivo distinto" }, { status: 400 });
  if (!req.body) return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });
  try {
    const size = await saveStream(req.body, data.key, MAX_UPLOAD_BYTES);
    return NextResponse.json({ size });
  } catch (e) {
    const tooLarge = e instanceof Error && e.message === "FILE_TOO_LARGE";
    return NextResponse.json({ error: tooLarge ? "El archivo supera el máximo permitido." : "La subida se interrumpió." }, { status: tooLarge ? 413 : 400 });
  }
}
