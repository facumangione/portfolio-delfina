// Filtros de la galería: tipos y conversión desde/hacia la URL.
// El filtrado en sí lo hace la base de datos (ver buildPhotoQuery en lib/photos.ts),
// así la galería funciona igual con 20 o con 5.000 fotos.

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
  subidas: "Últimas subidas",
} as const;
export type SortKey = keyof typeof SORTS;

export const EMPTY_FILTERS: Filters = { categoria: "", tema: "", etiqueta: "", anio: "", orientacion: "", q: "", orden: "recientes" };

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

export function parseFilters(params: Params): Filters {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return typeof v === "string" ? v : "";
  };
  const orden = get("orden");
  const orientacion = get("orientacion");
  return {
    categoria: get("categoria"),
    tema: get("tema"),
    etiqueta: get("etiqueta"),
    anio: /^\d{4}$/.test(get("anio")) ? get("anio") : "",
    q: get("q").slice(0, 100),
    orientacion: (["horizontal", "vertical", "cuadrada"].includes(orientacion) ? orientacion : "") as Filters["orientacion"],
    orden: (orden in SORTS ? orden : "recientes") as SortKey,
  };
}

export function toQueryString(f: Filters, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v && !(k === "orden" && v === "recientes")) params.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Opciones disponibles en cada filtro (las calcula el servidor). */
export interface Facets {
  categories: { slug: string; name: string }[];
  themes: string[];
  tags: string[];
  years: string[];
}
