import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage";
import { formatBytes, formatDate, megapixels, resolutionLabel } from "@/lib/utils";
import { PanelTitle } from "@/components/panel/ui";
import { ConfirmButton } from "@/components/panel/ConfirmButton";
import { PhotoEditForm } from "@/components/panel/PhotoEditForm";
import { TLink } from "@/components/motion/PageTransition";
import { archiveOriginal, deletePhoto } from "../../actions";

// Edición de una foto: metadatos a la izquierda, archivos (original vs optimizada) a la derecha.
export default async function EditPhoto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [photo, categories, themes, allTags] = await Promise.all([
    db.photo.findUnique({ where: { id }, include: { tags: true, _count: { select: { favorites: true } } } }),
    db.category.findMany({ orderBy: { order: "asc" } }),
    db.photo.findMany({ where: { theme: { not: null } }, distinct: ["theme"], select: { theme: true } }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!photo) notFound();

  const files = [
    {
      label: "Original",
      note: photo.originalArchivedAt
        ? `Archivado el ${formatDate(photo.originalArchivedAt, "short")}: ya no ocupa espacio. Las descargas entregan la versión web.`
        : "Alta resolución · privado · sólo descarga",
      dims: `${photo.width}×${photo.height}`,
      size: photo.originalSize,
      format: (photo.originalName.split(".").pop() ?? "").toUpperCase(),
    },
    { label: "Optimizada", note: "Vista ampliada y página individual", dims: "≤ 2400 px", size: photo.displaySize, format: photo.displayPath.endsWith(".jpg") ? "JPG" : "WEBP" },
    { label: "Miniatura", note: "Galería y listados", dims: "≤ 900 px", size: photo.thumbSize || null, format: photo.displayPath.endsWith(".jpg") ? "JPG" : "WEBP" },
  ];

  return (
    <>
      <PanelTitle eyebrow={photo.published ? "Publicada" : "Borrador"} title={photo.title}>
        <div className="flex gap-6">
          {photo.published && <TLink href={`/foto/${photo.slug}`} className="eyebrow hover:text-bone">Ver en el sitio ↗</TLink>}
          <TLink href="/estudio/fotos" className="eyebrow hover:text-bone">← Volver</TLink>
        </div>
      </PanelTitle>

      <div className="grid gap-14 xl:grid-cols-[1fr_380px]">
        <PhotoEditForm
          photo={{
            id: photo.id, title: photo.title, description: photo.description ?? "", takenAt: photo.takenAt?.toISOString().slice(0, 10) ?? "",
            categoryId: photo.categoryId ?? "", theme: photo.theme ?? "", location: photo.location ?? "", camera: photo.camera ?? "",
            tags: photo.tags.map((t) => t.name).join(", "), published: photo.published, featured: photo.featured, downloadable: photo.downloadable,
          }}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          themes={themes.map((t) => t.theme!)}
          tags={allTags.map((t) => t.name)}
        />

        <aside className="space-y-8">
          <div className="overflow-hidden bg-smoke" style={{ aspectRatio: photo.width / photo.height }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicUrl(photo.displayPath)} alt="" className="h-full w-full object-cover" />
          </div>

          <div>
            <p className="eyebrow mb-4">Archivos</p>
            <ul className="divide-y divide-line border-y border-line">
              {files.map((f) => (
                <li key={f.label} className="py-3">
                  <div className="flex justify-between text-sm">
                    <span>{f.label}</span>
                    <span className="text-mist tabular-nums">{f.format} · {f.dims}{f.size ? ` · ${formatBytes(f.size)}` : ""}</span>
                  </div>
                  <p className="mt-1 text-xs text-mist">{f.note}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-mist">
              {megapixels(photo.width, photo.height)} · {resolutionLabel(photo.width, photo.height)} · archivo «{photo.originalName}»
            </p>
            <p className="mt-1 text-xs text-mist">{photo.views} visitas · {photo.downloads} descargas · {photo._count.favorites} favoritos</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href={`/api/photos/${photo.id}/download`} className="inline-flex items-center border border-bone/30 px-5 py-2.5 text-[11px] tracking-[0.2em] uppercase transition-all duration-500 hover:bg-bone hover:text-ink">
              {photo.originalArchivedAt ? "Descargar versión web" : "Descargar original"}
            </a>
          </div>

          {!photo.originalArchivedAt && (
            <form action={archiveOriginal} className="border-t border-line pt-6">
              <input type="hidden" name="id" value={photo.id} />
              <p className="mb-4 text-xs leading-relaxed text-mist">
                Archivar el original libera {formatBytes(photo.originalSize)} en R2. La foto sigue en el sitio con su versión web de 2400 px.
              </p>
              <ConfirmButton
                variant="ghost"
                message={"¿Archivar el original?\n\nSe borra del almacenamiento el archivo original para liberar espacio. La foto sigue en el sitio y las descargas pasan a ser la versión web de 2400 px.\n\nHacelo sólo si tenés el original guardado en tu computadora o en un disco. No se puede deshacer."}
              >
                Archivar original
              </ConfirmButton>
            </form>
          )}

          <form action={deletePhoto} className="border-t border-line pt-6">
            <input type="hidden" name="id" value={photo.id} />
            <ConfirmButton message="¿Eliminar esta fotografía? Se borran el original y sus versiones optimizadas.">Eliminar fotografía</ConfirmButton>
          </form>
        </aside>
      </div>
    </>
  );
}
