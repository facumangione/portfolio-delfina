import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getFacets, queryPhotos } from "@/lib/photos";
import { Gallery } from "@/components/gallery/Gallery";
import { parseFilters } from "@/components/gallery/filters";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Galería" };
export const dynamic = "force-dynamic";

// El servidor entrega la primera página ya filtrada; el resto lo pide el navegador.
export default async function GalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const [page, facets, totalPublished] = await Promise.all([queryPhotos(filters), getFacets(), db.photo.count({ where: { published: true } })]);
  return (
    <div className="px-6 pt-36 pb-32 md:px-12 md:pt-44">
      <PageHeader eyebrow={`Archivo · ${totalPublished} obras`} title={<>Galería</>} />
      {/* La key reinicia la galería si se llega con otra URL (p. ej. desde una etiqueta) */}
      <Gallery key={JSON.stringify(params)} initialPage={page} initialFilters={filters} facets={facets} />
    </div>
  );
}
