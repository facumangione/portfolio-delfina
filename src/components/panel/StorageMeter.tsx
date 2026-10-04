import { STORAGE_WARN_RATIO, storageUsage } from "@/lib/quota";
import { formatBytes } from "@/lib/utils";

/**
 * Barra con el espacio usado en R2 respecto del límite gratuito (10 GB).
 * Verde mientras sobra espacio, ámbar desde el 80 % y roja al llegar al límite
 * (en ese punto el sitio ya no acepta fotos nuevas, ver lib/quota.ts).
 */
export async function StorageMeter() {
  const u = await storageUsage();
  const percent = Math.min(100, u.ratio * 100);
  const full = u.used >= u.limit;
  const warn = !full && u.ratio >= STORAGE_WARN_RATIO;
  const bar = full ? "bg-red-400/80" : warn ? "bg-amber-300/80" : "bg-emerald-300/70";

  return (
    <div className="border-t border-line pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow">Espacio en R2</p>
        <p className="text-xs text-mist">Gratis hasta {formatBytes(u.limit)}</p>
      </div>
      <p className="mt-3 text-4xl font-extralight tracking-tight tabular-nums">
        {formatBytes(u.used)} <span className="text-xl text-mist">de {formatBytes(u.limit)}</span>
      </p>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label="Espacio usado">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(percent, u.used > 0 ? 1 : 0)}%` }} />
      </div>
      <p className="mt-3 text-xs text-mist">
        {percent.toFixed(percent < 10 ? 1 : 0)} % usado · quedan {formatBytes(u.free)} · originales {formatBytes(u.originals)}, versiones web {formatBytes(u.optimized)}
      </p>
      {warn && <p className="mt-3 text-sm text-amber-300/90">Queda poco espacio gratis. Conviene borrar fotos que ya no se usen.</p>}
      {full && <p className="mt-3 text-sm text-red-300">Se llegó al límite gratis: el sitio no acepta fotos nuevas hasta liberar espacio.</p>}
    </div>
  );
}
