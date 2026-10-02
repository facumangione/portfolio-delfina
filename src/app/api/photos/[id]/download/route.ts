import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { fileStream } from "@/lib/storage";
import { refreshPhotoIndex } from "@/lib/photo-index";

/*
 * Descarga del ORIGINAL en alta resolución.
 * El archivo está fuera de la carpeta pública: sólo se entrega por aquí,
 * después de comprobar sesión, permiso del usuario y que la foto sea descargable.
 * Se envía como stream, sin cargarlo en memoria (puede pesar cientos de MB).
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
  return new Response(fileStream(photo.originalPath), {
    headers: {
      "Content-Type": photo.originalMime,
      "Content-Length": String(photo.originalSize),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
