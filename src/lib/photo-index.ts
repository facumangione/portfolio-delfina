import { db } from "./db";

/*
 * Campos "calculados" de cada foto que guardamos en la base para poder filtrar
 * y ordenar directamente con SQL, sin traer todas las fotos al servidor:
 *   orientation, favoritesCount, popularity y searchText.
 * Hay que llamar a refreshPhotoIndex() cada vez que cambia algo que los afecta
 * (subida, edición, favorito, visita, descarga).
 */

export function normalizeText(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function orientationOf(width: number, height: number) {
  if (Math.abs(width / height - 1) < 0.06) return "cuadrada";
  return width > height ? "horizontal" : "vertical";
}

export async function refreshPhotoIndex(id: string) {
  const p = await db.photo.findUnique({
    where: { id },
    include: { tags: { select: { name: true } }, category: { select: { name: true } }, _count: { select: { favorites: true } } },
  });
  if (!p) return;
  const favoritesCount = p._count.favorites;
  await db.photo.update({
    where: { id },
    data: {
      orientation: orientationOf(p.width, p.height),
      favoritesCount,
      popularity: p.views + p.downloads * 3 + favoritesCount * 5,
      searchText: normalizeText(
        [p.title, p.description, p.theme, p.location, p.camera, p.category?.name, ...p.tags.map((t) => t.name)]
          .filter(Boolean)
          .join(" "),
      ),
    },
  });
}
