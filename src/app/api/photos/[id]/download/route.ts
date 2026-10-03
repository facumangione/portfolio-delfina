import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { readFile, signedDownloadUrl } from "@/lib/storage";
import { refreshPhotoIndex } from "@/lib/photo-index";

/*
 * Descarga del ORIGINAL en alta resolución.
 * El archivo está fuera de la carpeta pública: sólo se entrega por aquí,
 * después de comprobar sesión, permiso del usuario y que la foto sea descargable.
 * Con R2 redirigimos a una URL firmada que vence en minutos: el archivo
 * (cientos de MB) baja directo del bucket. En modo local se envía como stream.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login`, _req.url));

  const photo = await db.photo.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const isStaff = can(user.role, "photos.manage");
  const allowed = isStaff || (photo.published && photo.downloadable && user.canDownload && can(user.role, "photos.download"));
  if (!allowed) return NextResponse.json({ error: "Descarga no permitida" }, { status: 403 });

  if (!isStaff) {
    await db.photo.update({ where: { id }, data: { downloads: { increment: 1 } } });
    await refreshPhotoIndex(id);
  }

  const ext = photo.originalName.includes(".") ? photo.originalName.split(".").pop() : "jpg";
  const filename = `${photo.slug}.${ext}`;
  const signed = await signedDownloadUrl(photo.originalPath, filename);
  if (signed) return NextResponse.redirect(signed, { headers: { "Cache-Control": "private, no-store" } });

  const file = await readFile(photo.originalPath);
  if (!file) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  return new Response(file.body, {
    headers: {
      "Content-Type": photo.originalMime,
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
