import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getFacets, queryPhotos } from "@/lib/photos";
import { Gallery } from "@/components/gallery/Gallery";
import { EMPTY_FILTERS } from "@/components/gallery/filters";
import { PageHeader } from "@/components/PageHeader";
import { TLink } from "@/components/motion/PageTransition";

export const metadata: Metadata = { title: "Favoritos" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/favoritos");
  const mine = { favorites: { some: { userId: user.id } } };
  const [page, facets] = await Promise.all([queryPhotos(EMPTY_FILTERS, 0, mine), getFacets(mine)]);

  return (
    <div className="px-6 pt-36 pb-32 md:px-12 md:pt-44">
      <PageHeader eyebrow="Tu colección" title={<>Favoritos</>}>
        Las fotografías que marcaste con el corazón. Podés filtrarlas, ordenarlas y descargarlas igual que en la galería.
      </PageHeader>
      <Gallery
        initialPage={page}
        initialFilters={EMPTY_FILTERS}
        facets={facets}
        onlyFavorites
        emptyMessage={
          <div className="space-y-6">
            <p className="font-display text-4xl font-light text-mist">Todavía no guardaste ninguna fotografía.</p>
            <TLink href="/galeria" className="eyebrow inline-block border-b border-mist pb-1 transition-colors hover:border-bone hover:text-bone">Explorar la galería</TLink>
          </div>
        }
      />
    </div>
  );
}
