import type { PhotoDTO } from "@/lib/photos";

// Lógica pura de filtrado y ordenamiento (sin React), fácil de leer y de testear.

export interface Filters {
  categoria: string; // slug de categoría
  tema: string;
  etiqueta: string;
  anio: string;
  orientacion: "" | "horizontal" | "vertical" | "cuadrada";
  q: string; // búsqueda libre
  orden: SortKey;
}

export const SORTS = {
  recientes: "Más recientes",
  antiguas: "Más antiguas",
  nombre: "Nombre",
  populares: "Popularidad",
  favoritas: "Más favoritas",
  descargas: "Más descargadas",
  resolucion: "Mayor resolución",
} as const;
export type SortKey = keyof typeof SORTS;

export const EMPTY_FILTERS: Filters = { categoria: "", tema: "", etiqueta: "", anio: "", orientacion: "", q: "", orden: "recientes" };

export function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const orden = get("orden");
  const orientacion = get("orientacion");
  return {
    categoria: get("categoria"),
    tema: get("tema"),
    etiqueta: get("etiqueta"),
    anio: get("anio"),
    q: get("q"),
    orientacion: (["horizontal", "vertical", "cuadrada"].includes(orientacion) ? orientacion : "") as Filters["orientacion"],
    orden: (orden in SORTS ? orden : "recientes") as SortKey,
  };
}

export function toQueryString(f: Filters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v && !(k === "orden" && v === "recientes")) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

const year = (p: PhotoDTO) => (p.takenAt ? new Date(p.takenAt).getUTCFullYear().toString() : "");
const orientation = (p: PhotoDTO) => (Math.abs(p.width / p.height - 1) < 0.06 ? "cuadrada" : p.width > p.height ? "horizontal" : "vertical");
const time = (p: PhotoDTO) => new Date(p.takenAt ?? p.createdAt).getTime();
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function applyFilters(photos: PhotoDTO[], f: Filters): PhotoDTO[] {
  const q = normalize(f.q.trim());
  const result = photos.filter((p) => {
    if (f.categoria && p.category?.slug !== f.categoria) return false;
    if (f.tema && p.theme !== f.tema) return false;
    if (f.etiqueta && !p.tags.includes(f.etiqueta)) return false;
    if (f.anio && year(p) !== f.anio) return false;
    if (f.orientacion && orientation(p) !== f.orientacion) return false;
    if (q) {
      const haystack = normalize([p.title, p.description, p.theme, p.location, p.category?.name, ...p.tags].join(" "));
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorters: Record<SortKey, (a: PhotoDTO, b: PhotoDTO) => number> = {
    recientes: (a, b) => time(b) - time(a),
    antiguas: (a, b) => time(a) - time(b),
    nombre: (a, b) => a.title.localeCompare(b.title, "es"),
    populares: (a, b) => b.popularity - a.popularity,
    favoritas: (a, b) => b.favoritesCount - a.favoritesCount,
    descargas: (a, b) => b.downloads - a.downloads,
    resolucion: (a, b) => b.width * b.height - a.width * a.height,
  };
  return result.sort(sorters[f.orden]);
}

/** Valores disponibles para cada filtro, calculados a partir de las fotos. */
export function facets(photos: PhotoDTO[]) {
  const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const categories = new Map<string, string>();
  photos.forEach((p) => p.category && categories.set(p.category.slug, p.category.name));
  return {
    categories: [...categories.entries()].map(([slug, name]) => ({ slug, name })),
    themes: uniq(photos.map((p) => p.theme ?? "")),
    tags: uniq(photos.flatMap((p) => p.tags)),
    years: uniq(photos.map(year)).reverse(),
  };
}
