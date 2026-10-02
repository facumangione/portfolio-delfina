import { NextResponse } from "next/server";
import { parseFilters } from "@/components/gallery/filters";
import { queryPhotos } from "@/lib/photos";
import { getCurrentUser } from "@/lib/session";

/*
 * GET /api/photos?categoria=paisaje&orden=nombre&offset=30
 * Devuelve una página de fotos publicadas que cumplen los filtros.
 * Con ?favoritas=1 se limita a los favoritos del usuario logueado.
 * La usa la galería para el scroll infinito y para aplicar filtros.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const filters = parseFilters(params);
  const offset = Math.max(0, Number(params.get("offset")) || 0);

  let extra = {};
  if (params.get("favoritas") === "1") {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
    extra = { favorites: { some: { userId: user.id } } };
  }

  return NextResponse.json(await queryPhotos(filters, offset, extra));
}
