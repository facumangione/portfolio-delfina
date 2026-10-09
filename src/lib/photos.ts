import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { publicUrl } from "./storage";
import { normalizeText } from "./photo-index";
import type { Facets, Filters, SortKey } from "@/components/gallery/filters";

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
  /** El original se archivó: la descarga entrega la versión web (originalSize es su peso). */
  originalArchived: boolean;
  thumbUrl: string;
  displayUrl: string;
  blurDataUrl: string;
  /** Punto de enfoque (0–100) o null si todavía no se calculó (ver lib/focus.ts). */
  focusX: number | null;
  focusY: number | null;
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
} satisfies Prisma.PhotoInclude;

type PhotoWithRelations = Prisma.PhotoGetPayload<{ include: typeof photoInclude }>;

export function toDTO(p: PhotoWithRelations): PhotoDTO {
  const favoritesCount = p.favoritesCount;
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
    originalSize: p.originalArchivedAt ? p.displaySize : p.originalSize,
    originalArchived: Boolean(p.originalArchivedAt),
    thumbUrl: publicUrl(p.thumbPath),
    displayUrl: publicUrl(p.displayPath),
    blurDataUrl: p.blurDataUrl,
    focusX: p.focusX,
    focusY: p.focusY,
    downloadable: p.downloadable,
    featured: p.featured,
    views: p.views,
    downloads: p.downloads,
    favoritesCount,
    popularity: p.popularity,
  };
}

export async function getPublishedPhotos(where: Prisma.PhotoWhereInput = {}, take?: number): Promise<PhotoDTO[]> {
  const photos = await db.photo.findMany({
    where: { published: true, ...where },
    include: photoInclude,
    orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
    take,
  });
  return photos.map(toDTO);
}

// ---------------------------------------------------------------------------
// Galería paginada: los filtros se traducen a una consulta SQL (vía Prisma) y
// se devuelve sólo una "página" de resultados. El navegador pide la siguiente
// página cuando el usuario llega al final (scroll infinito).
// ---------------------------------------------------------------------------

export const PAGE_SIZE = 30;

const ORDER: Record<SortKey, Prisma.PhotoOrderByWithRelationInput[]> = {
  recientes: [{ takenAt: "desc" }, { createdAt: "desc" }],
  antiguas: [{ takenAt: "asc" }, { createdAt: "asc" }],
  nombre: [{ title: "asc" }],
  populares: [{ popularity: "desc" }],
  favoritas: [{ favoritesCount: "desc" }, { popularity: "desc" }],
  descargas: [{ downloads: "desc" }],
  resolucion: [{ width: "desc" }, { height: "desc" }],
  subidas: [{ createdAt: "desc" }],
};

export function buildPhotoWhere(f: Filters, extra: Prisma.PhotoWhereInput = {}): Prisma.PhotoWhereInput {
  const and: Prisma.PhotoWhereInput[] = [{ published: true }, extra];
  if (f.categoria) and.push({ category: { slug: f.categoria } });
  if (f.tema) and.push({ theme: f.tema });
  if (f.etiqueta) and.push({ tags: { some: { name: f.etiqueta } } });
  if (f.orientacion) and.push({ orientation: f.orientacion });
  if (f.anio) {
    const y = Number(f.anio);
    and.push({ takenAt: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) } });
  }
  // Cada palabra buscada tiene que aparecer en el texto indexado de la foto
  for (const word of normalizeText(f.q).split(/\s+/).filter(Boolean)) {
    and.push({ searchText: { contains: word } });
  }
  return { AND: and };
}

export interface PhotoPage {
  photos: PhotoDTO[];
  total: number;
  nextOffset: number | null;
}

export async function queryPhotos(f: Filters, offset = 0, extra: Prisma.PhotoWhereInput = {}): Promise<PhotoPage> {
  const where = buildPhotoWhere(f, extra);
  const [rows, total] = await Promise.all([
    db.photo.findMany({
      where,
      include: photoInclude,
      // el id al final hace que el orden sea estable entre páginas
      orderBy: [...ORDER[f.orden], { id: "asc" }],
      skip: offset,
      take: PAGE_SIZE,
    }),
    db.photo.count({ where }),
  ]);
  const next = offset + rows.length;
  return { photos: rows.map(toDTO), total, nextOffset: next < total ? next : null };
}

/** Valores posibles de cada filtro (sólo los que tienen fotos publicadas). */
export async function getFacets(extra: Prisma.PhotoWhereInput = {}): Promise<Facets> {
  const where: Prisma.PhotoWhereInput = { published: true, ...extra };
  const [categories, themes, tags, dates] = await Promise.all([
    db.category.findMany({ where: { photos: { some: where } }, orderBy: { order: "asc" }, select: { slug: true, name: true } }),
    db.photo.findMany({ where: { ...where, theme: { not: null } }, distinct: ["theme"], select: { theme: true } }),
    db.tag.findMany({ where: { photos: { some: where } }, orderBy: { name: "asc" }, select: { name: true } }),
    db.photo.findMany({ where: { ...where, takenAt: { not: null } }, select: { takenAt: true } }),
  ]);
  const years = [...new Set(dates.map((d) => String(d.takenAt!.getUTCFullYear())))].sort().reverse();
  return {
    categories,
    themes: themes.map((t) => t.theme!).sort((a, b) => a.localeCompare(b, "es")),
    tags: tags.map((t) => t.name),
    years,
  };
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
