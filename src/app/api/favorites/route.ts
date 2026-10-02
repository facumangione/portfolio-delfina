import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { refreshPhotoIndex } from "@/lib/photo-index";

// POST agrega y DELETE quita una foto de los favoritos del usuario logueado.
const body = z.object({ photoId: z.string().min(1) });

async function handle(req: Request, add: boolean) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const key = { userId: user.id, photoId: parsed.data.photoId };

  if (add) {
    const photo = await db.photo.findFirst({ where: { id: key.photoId, published: true }, select: { id: true } });
    if (!photo) return NextResponse.json({ error: "No existe" }, { status: 404 });
    await db.favorite.upsert({ where: { userId_photoId: key }, create: key, update: {} });
  } else {
    await db.favorite.deleteMany({ where: key });
  }
  await refreshPhotoIndex(key.photoId); // actualiza el contador y la popularidad
  return NextResponse.json({ ok: true });
}

export const POST = (req: Request) => handle(req, true);
export const DELETE = (req: Request) => handle(req, false);
