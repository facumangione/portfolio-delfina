import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { publicUrl } from "./storage";

// Forma "plana" y serializable de una foto, la que reciben los componentes cliente.
export interface PhotoDTO {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  takenAt: string | null;
  createdAt: string;
  theme: string | null;
  location: string | null;
  camera: string | null;
  category: { name: string; slug: string } | null;
  tags: string[];
  width: number;
  height: number;
  originalSize: number;
  thumbUrl: string;
  displayUrl: string;
  blurDataUrl: string;
  downloadable: boolean;
  featured: boolean;
  views: number;
  downloads: number;
  favoritesCount: number;
  popularity: number;
}

export const photoInclude = {
  category: { select: { name: true, slug: true } },
  tags: { select: { name: true }, orderBy: { name: "asc" } },
  _count: { select: { favorites: true } },
} satisfies Prisma.PhotoInclude;

type PhotoWithRelations = Prisma.PhotoGetPayload<{ include: typeof photoInclude }>;

export function toDTO(p: PhotoWithRelations): PhotoDTO {
  const favoritesCount = p._count.favorites;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    takenAt: p.takenAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    theme: p.theme,
    location: p.location,
    camera: p.camera,
    category: p.category,
    tags: p.tags.map((t) => t.name),
    width: p.width,
    height: p.height,
    originalSize: p.originalSize,
    thumbUrl: publicUrl(p.thumbPath),
    displayUrl: publicUrl(p.displayPath),
    blurDataUrl: p.blurDataUrl,
    downloadable: p.downloadable,
    featured: p.featured,
    views: p.views,
    downloads: p.downloads,
    favoritesCount,
    // Popularidad: ponderamos favoritos y descargas por encima de las visitas
    popularity: p.views + p.downloads * 3 + favoritesCount * 5,
  };
}

export async function getPublishedPhotos(where: Prisma.PhotoWhereInput = {}): Promise<PhotoDTO[]> {
  const photos = await db.photo.findMany({
    where: { published: true, ...where },
    include: photoInclude,
    orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
  });
  return photos.map(toDTO);
}

export async function getFavoriteIds(userId: string | undefined): Promise<string[]> {
  if (!userId) return [];
  const favs = await db.favorite.findMany({ where: { userId }, select: { photoId: true } });
  return favs.map((f) => f.photoId);
}

/** Genera un slug único a partir del título. */
export async function uniqueSlug(base: string, ignoreId?: string) {
  let slug = base;
  for (let i = 2; ; i++) {
    const existing = await db.photo.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${base}-${i}`;
  }
}
