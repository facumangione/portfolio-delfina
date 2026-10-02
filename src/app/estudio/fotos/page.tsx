import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage";
import { formatBytes, formatDate, resolutionLabel } from "@/lib/utils";
import { Badge, Button, PanelTitle, selectClass } from "@/components/panel/ui";
import { TLink } from "@/components/motion/PageTransition";
import { assignCategory, togglePublished } from "../actions";

// Listado de todas las fotos (publicadas y borradores) con acciones rápidas.
export default async function StudioPhotos({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const where = estado === "borradores" ? { published: false } : estado === "publicadas" ? { published: true } : {};
  const [photos, categories] = await Promise.all([
    db.photo.findMany({ where, orderBy: { createdAt: "desc" }, include: { category: true, _count: { select: { favorites: true } } } }),
    db.category.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <>
      <PanelTitle eyebrow="Estudio" title="Fotografías">
        <div className="flex gap-6">
          {[["", "Todas"], ["publicadas", "Publicadas"], ["borradores", "Borradores"]].map(([value, label]) => (
            <TLink key={value} href={value ? `/estudio/fotos?estado=${value}` : "/estudio/fotos"} className={`eyebrow transition-colors hover:text-bone ${(estado ?? "") === value ? "text-bone!" : ""}`}>
              {label}
            </TLink>
          ))}
        </div>
      </PanelTitle>

      {/* Asignación masiva de categoría: el select y el botón usan form="bulk" */}
      <form id="bulk" action={assignCategory} className="mb-8 flex flex-wrap items-end gap-4">
        <label className="w-56">
          <span className="eyebrow mb-1 block">Asignar categoría a seleccionadas</span>
          <select name="categoryId" className={selectClass}>
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <Button type="submit">Aplicar</Button>
      </form>

      <div className="divide-y divide-line border-y border-line">
        {photos.map((p) => (
          <div key={p.id} className="grid grid-cols-[auto_64px_1fr] items-center gap-4 py-4 md:grid-cols-[auto_88px_1fr_auto_auto]">
            <input type="checkbox" name="ids" value={p.id} form="bulk" className="h-4 w-4 accent-[#d8c3a5]" aria-label={`Seleccionar ${p.title}`} />
            <TLink href={`/estudio/fotos/${p.id}`} className="block aspect-square overflow-hidden bg-smoke">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicUrl(p.thumbPath)} alt="" className="h-full w-full object-cover" />
            </TLink>
            <div className="min-w-0">
              <TLink href={`/estudio/fotos/${p.id}`} className="block truncate font-display text-xl hover:text-accent">{p.title}</TLink>
              <p className="mt-1 text-xs text-mist">
                {p.category?.name ?? "Sin categoría"} · {formatDate(p.takenAt, "short")} · {p.width}×{p.height} {resolutionLabel(p.width, p.height)}
              </p>
              <p className="mt-1 text-xs text-mist">
                Original {formatBytes(p.originalSize)} → optimizada {formatBytes(p.displaySize)}
              </p>
            </div>
            <div className="col-span-3 flex gap-2 md:col-span-1">
              {p.published ? <Badge tone="ok">Publicada</Badge> : <Badge tone="warn">Borrador</Badge>}
              {p.featured && <Badge tone="accent">Destacada</Badge>}
              {!p.downloadable && <Badge>Sin descarga</Badge>}
            </div>
            <form action={togglePublished} className="col-span-3 md:col-span-1">
              <input type="hidden" name="id" value={p.id} />
              <Button variant="ghost">{p.published ? "Despublicar" : "Publicar"}</Button>
            </form>
          </div>
        ))}
        {photos.length === 0 && <p className="py-16 text-center text-mist">No hay fotografías.</p>}
      </div>
    </>
  );
}
