import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { PanelTitle, Stat } from "@/components/panel/ui";
import { StorageMeter } from "@/components/panel/StorageMeter";
import { TLink } from "@/components/motion/PageTransition";

// Resumen del estudio: números clave y el peso de originales vs optimizadas.
export default async function StudioHome() {
  const [published, drafts, sizes, unread, recent, top] = await Promise.all([
    db.photo.count({ where: { published: true } }),
    db.photo.count({ where: { published: false } }),
    db.photo.aggregate({ _sum: { originalSize: true, displaySize: true, downloads: true, views: true } }),
    db.contactMessage.count({ where: { read: false } }),
    db.photo.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.photo.findMany({ where: { published: true }, orderBy: [{ downloads: "desc" }, { views: "desc" }], take: 5, include: { _count: { select: { favorites: true } } } }),
  ]);
  const original = sizes._sum.originalSize ?? 0;
  const optimized = sizes._sum.displaySize ?? 0;

  return (
    <>
      <PanelTitle eyebrow="Estudio" title="Resumen">
        <TLink href="/estudio/subir" className="border border-bone/30 px-5 py-2.5 text-[11px] tracking-[0.2em] uppercase transition-all duration-500 hover:bg-bone hover:text-ink">
          Subir fotografías
        </TLink>
      </PanelTitle>

      <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Publicadas" value={published} />
        <Stat label="Borradores" value={drafts} note="Subidas que aún no se ven en el sitio" />
        <Stat label="Descargas" value={sizes._sum.downloads ?? 0} note={`${sizes._sum.views ?? 0} visitas a fotos`} />
        <Stat label="Mensajes sin leer" value={unread} />
      </div>

      <div className="mt-16 border-t border-line pt-8">
        <p className="eyebrow mb-6">Almacenamiento</p>
        <div className="mb-10 max-w-2xl"><StorageMeter /></div>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-3xl font-extralight tracking-tight">{formatBytes(original)}</p>
            <p className="mt-2 text-sm text-mist">Originales en alta resolución. Privados: sólo se entregan como descarga.</p>
          </div>
          <div>
            <p className="text-3xl font-extralight tracking-tight">{formatBytes(optimized)}</p>
            <p className="mt-2 text-sm text-mist">Versiones optimizadas (WebP 2400 px) que se usan para navegar. Es lo que carga el visitante.</p>
          </div>
        </div>
        {original > 0 && (
          <div className="mt-6 h-px w-full bg-line">
            <div className="h-px bg-accent" style={{ width: `${Math.max(1, (optimized / original) * 100)}%` }} />
          </div>
        )}
      </div>

      <div className="mt-16 grid gap-16 xl:grid-cols-2">
        <div>
          <p className="eyebrow mb-6">Últimas subidas</p>
          <div className="grid grid-cols-3 gap-3">
            {recent.map((p) => (
              <TLink key={p.id} href={`/estudio/fotos/${p.id}`} className="group relative block aspect-square overflow-hidden bg-smoke">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicUrl(p.thumbPath)} alt={p.title} className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                {!p.published && <span className="absolute top-2 left-2 bg-ink/80 px-2 py-0.5 text-[10px] tracking-widest text-amber-300 uppercase">Borrador</span>}
              </TLink>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-6">Más populares</p>
          <ul>
            {top.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between gap-4 border-b border-line py-3 text-sm">
                <span className="flex items-center gap-4">
                  <span className="eyebrow w-5">{i + 1}</span>
                  <TLink href={`/estudio/fotos/${p.id}`} className="hover:text-accent">{p.title}</TLink>
                </span>
                <span className="text-xs text-mist tabular-nums">{p.downloads} desc · {p._count.favorites} fav · {p.views} vistas</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
