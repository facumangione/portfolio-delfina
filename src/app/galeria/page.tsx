import type { Metadata } from "next";
import { getPublishedPhotos } from "@/lib/photos";
import { Gallery } from "@/components/gallery/Gallery";
import { parseFilters } from "@/components/gallery/filters";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Galería" };
export const dynamic = "force-dynamic";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const photos = await getPublishedPhotos();
  return (
    <div className="px-6 pt-36 pb-32 md:px-12 md:pt-44">
      <PageHeader eyebrow={`Archivo · ${photos.length} obras`} title={<>Galería</>} />
      {/* La key fuerza a reiniciar los filtros si se llega con otra URL (p. ej. desde una etiqueta) */}
      <Gallery key={JSON.stringify(params)} photos={photos} initialFilters={parseFilters(params)} />
    </div>
  );
}
