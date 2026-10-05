import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, fileSize, readToken, removeFiles } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { uniqueSlug } from "@/lib/photos";
import { refreshPhotoIndex } from "@/lib/photo-index";
import { titleFromFilename, type UploadTicket } from "@/lib/uploads";

/*
 * Subida de fotografías, paso 2 de 2.
 *
 * Los tres archivos ya están en el almacenamiento. Comprobamos que existan
 * (y medimos su tamaño real, sin confiar en lo que diga el navegador) y
 * creamos la foto aplicando los datos del lote: categoría, tema, etiquetas y
 * si se publica directamente. La fotógrafa puede ajustar cada foto después.
 */

interface Body {
  token?: string;
  width?: number;
  height?: number;
  blurDataUrl?: string;
  takenAt?: string | null;
  categoryId?: string;
  theme?: string;
  tags?: string;
  publish?: boolean;
  title?: string;
  description?: string;
}

const MAX_SIDE = 100_000;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "photos.manage")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = ((await req.json().catch(() => null)) ?? {}) as Body;
  const ticket = readToken<UploadTicket>(body.token ?? "");
  if (!ticket || ticket.uid !== user.id || ticket.exp < Date.now()) return NextResponse.json({ error: "La subida venció. Volvé a intentarlo." }, { status: 400 });
  if (await db.photo.findUnique({ where: { id: ticket.id }, select: { id: true } })) return NextResponse.json({ error: "Esta foto ya se guardó." }, { status: 409 });

  const width = Math.round(Number(body.width));
  const height = Math.round(Number(body.height));
  if (!(width > 0 && height > 0 && width < MAX_SIDE && height < MAX_SIDE)) return NextResponse.json({ error: "Medidas de imagen inválidas." }, { status: 400 });
  const blurDataUrl = String(body.blurDataUrl ?? "");
  if (!/^data:image\/(webp|jpeg|png);base64,[\w+/=]+$/.test(blurDataUrl) || blurDataUrl.length > 8000) return NextResponse.json({ error: "Vista previa inválida." }, { status: 400 });
  const takenAt = body.takenAt ? new Date(body.takenAt) : null;

  const { keys } = ticket;
  const [originalSize, displaySize, thumbSize] = await Promise.all([fileSize(keys.original), fileSize(keys.display), fileSize(keys.thumb)]);
  if (originalSize === null || displaySize === null || thumbSize === null) return NextResponse.json({ error: "Falta algún archivo. Volvé a intentarlo." }, { status: 400 });
  if (originalSize > MAX_UPLOAD_BYTES) {
    await removeFiles(keys.original, keys.display, keys.thumb);
    return NextResponse.json({ error: "El archivo supera el máximo permitido." }, { status: 413 });
  }

  const categoryId = body.categoryId || null;
  const theme = body.theme?.trim() || null;
  const tagNames = [...new Set((body.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
  // Nombre y descripción escritos al subir; si no, el nombre sale del archivo
  const title = String(body.title ?? "").trim().slice(0, 200) || titleFromFilename(ticket.name);
  const description = String(body.description ?? "").trim().slice(0, 2000) || null;

  const photo = await db.photo.create({
    data: {
      id: ticket.id,
      title,
      description,
      slug: await uniqueSlug(slugify(title)),
      originalPath: keys.original,
      originalName: ticket.name,
      originalMime: ticket.mime,
      originalSize,
      width,
      height,
      displayPath: keys.display,
      displaySize,
      thumbSize,
      thumbPath: keys.thumb,
      blurDataUrl,
      takenAt: takenAt && !isNaN(takenAt.getTime()) ? takenAt : null,
      published: body.publish === true,
      uploadedById: user.id,
      categoryId: categoryId && (await db.category.findUnique({ where: { id: categoryId }, select: { id: true } })) ? categoryId : null,
      theme,
      tags: { connectOrCreate: tagNames.map((name) => ({ where: { name }, create: { name, slug: slugify(name) } })) },
    },
  });
  await refreshPhotoIndex(photo.id);
  return NextResponse.json({ id: photo.id, title: photo.title, width, height });
}
