import type { Prisma } from "@prisma/client";
import Form from "next/form";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage";
import { normalizeText } from "@/lib/photo-index";
import { formatBytes, formatDate, resolutionLabel } from "@/lib/utils";
import { Badge, Button, PanelTitle, inputClass, selectClass } from "@/components/panel/ui";
import { BulkBar } from "@/components/panel/BulkBar";
import { TLink } from "@/components/motion/PageTransition";
import { togglePublished } from "../actions";

/*
 * Listado de fotos del Estudio, preparado para archivos grandes:
 * búsqueda, filtros por estado y categoría, paginación de 60 en 60 y
 * acciones en lote (publicar, categoría, etiqueta, eliminar…).
 */
const PER_PAGE = 60;

type Search = { estado?: string; q?: string; categoria?: string; pagina?: string };

export default async function StudioPhotos({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);

  const and: Prisma.PhotoWhereInput[] = [];
  if (sp.estado === "borradores") and.push({ published: false });
  if (sp.estado === "publicadas") and.push({ published: true });
  if (sp.categoria === "ninguna") and.push({ categoryId: null });
  else if (sp.categoria) and.push({ categoryId: sp.categoria });
  for (const w of normalizeText(sp.q ?? "").split(/\s+/).filter(Boolean)) and.push({ OR: [{ searchText: { contains: w } }, { originalName: { contains: w, mode: "insensitive" } }] });
  const where: Prisma.PhotoWhereInput = { AND: and };

  const [photos, total, categories] = await Promise.all([
    db.photo.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { category: true } }),
    db.photo.count({ where }),
    db.category.findMany({ orderBy: { order: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const link = (patch: Partial<Search>) => {
    const params = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    const qs = params.toString();
    return `/estudio/fotos${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PanelTitle eyebrow={`Estudio · ${total} fotografías`} title="Fotografías">
        <div className="flex gap-6">
          {[["", "Todas"], ["publicadas", "Publicadas"], ["borradores", "Borradores"]].map(([value, label]) => (
            <TLink key={value} href={link({ estado: value, pagina: "" })} className={`eyebrow transition-colors hover:text-bone ${(sp.estado ?? "") === value ? "text-bone!" : ""}`}>
              {label}
            </TLink>
          ))}
        </div>
      </PanelTitle>

      {/* Búsqueda y filtro por categoría (formulario GET: se refleja en la URL) */}
      <Form action="/estudio/fotos" className="mb-6 flex flex-wrap items-end gap-6">
        {sp.estado && <input type="hidden" name="estado" value={sp.estado} />}
        <input name="q" defaultValue={sp.q} placeholder="Buscar por título, etiqueta o archivo" className={`${inputClass} w-72!`} />
        <select name="categoria" defaultValue={sp.categoria ?? ""} className={`${selectClass} w-48!`}>
          <option value="">Todas las categorías</option>
          <option value="ninguna">Sin categoría</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button variant="ghost" type="submit">Filtrar</Button>
      </Form>

      <BulkBar categories={categories.map((c) => ({ id: c.id, name: c.name }))} />

      <div className="divide-y divide-line border-y border-line">
        {photos.map((p) => (
          <div key={p.id} className="grid grid-cols-[auto_64px_1fr] items-center gap-4 py-4 md:grid-cols-[auto_88px_1fr_auto_auto]">
            <input type="checkbox" name="ids" value={p.id} form="bulk" className="h-4 w-4 accent-[#d8c3a5]" aria-label={`Seleccionar ${p.title}`} />
            <TLink href={`/estudio/fotos/${p.id}`} className="block aspect-square overflow-hidden bg-smoke">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicUrl(p.thumbPath)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </TLink>
            <div className="min-w-0">
              <TLink href={`/estudio/fotos/${p.id}`} className="block truncate font-display text-xl hover:text-accent">{p.title}</TLink>
              <p className="mt-1 text-xs text-mist">
                {p.category?.name ?? "Sin categoría"} · {formatDate(p.takenAt, "short")} · {p.width}×{p.height} {resolutionLabel(p.width, p.height)}
              </p>
              <p className="mt-1 text-xs text-mist">Original {formatBytes(p.originalSize)} → optimizada {formatBytes(p.displaySize)}</p>
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

      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-between">
          {page > 1 ? <TLink href={link({ pagina: String(page - 1) })} className="eyebrow hover:text-bone">← Anterior</TLink> : <span />}
          <span className="eyebrow tabular-nums">Página {page} de {pages}</span>
          {page < pages ? <TLink href={link({ pagina: String(page + 1) })} className="eyebrow hover:text-bone">Siguiente →</TLink> : <span />}
        </nav>
      )}
    </>
  );
}
