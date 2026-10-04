"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { inputClass, selectClass } from "./ui";
import { CategorySelect } from "./CategorySelect";
import { TLink } from "@/components/motion/PageTransition";
import { EASE_CINE } from "@/components/motion/easing";
import { formatBytes } from "@/lib/utils";
import { prepareImage } from "@/lib/client-image";
import { ACCEPT_ATTRIBUTE, FORMATS, extensionOf } from "@/lib/uploads";

/*
 * Subida de fotos con progreso real. Cada foto pasa por:
 *  1. "Preparando": el navegador genera la versión para pantalla, la miniatura
 *     y el desenfoque (lib/client-image.ts).
 *  2. Pide permiso a /api/upload/start, que devuelve URLs firmadas.
 *  3. "Subiendo": sube los tres archivos DIRECTO al almacenamiento (R2).
 *     Usamos XMLHttpRequest (y no fetch) porque es la única API del navegador
 *     que informa el progreso de SUBIDA (xhr.upload.onprogress).
 *  4. "Guardando": /api/upload/complete crea la foto en la base.
 *
 * Pensado para lotes grandes (cientos de fotos):
 *  - Se procesan de a 2 en paralelo (PARALLEL); el resto espera en cola.
 *  - Los datos del lote (categoría, tema, etiquetas, publicar) se aplican a
 *    todas las fotos al subirlas, para no tener que editarlas una por una.
 *  - Las que fallan se pueden reintentar con un click.
 *  - La lista muestra un resumen y sólo las últimas filas, para no saturar la página.
 */

type Status = "waiting" | "preparing" | "uploading" | "processing" | "done" | "error";
interface Item {
  key: string;
  file: File;
  preview: string;
  progress: number;
  status: Status;
  result?: { id: string; width: number; height: number };
  error?: string;
}

const PARALLEL = 2;
const VISIBLE_ROWS = 40;

export interface BatchOptions {
  categoryId: string;
  theme: string;
  tags: string;
  publish: boolean;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Error al subir");
  return data as T;
}

/**
 * Traduce la respuesta de error del bucket (un XML con <Code> y <Message>) a
 * algo que se entienda. Casi siempre es una variable S3_* mal cargada en Vercel.
 */
function storageError(status: number, body: string) {
  const code = body.match(/<Code>([^<]*)<\/Code>/)?.[1] ?? "";
  const message = body.match(/<Message>([^<]*)<\/Message>/)?.[1] ?? "";
  const hint =
    /access key/i.test(message) ? "S3_ACCESS_KEY_ID no es el Access Key ID de R2" :
    code === "SignatureDoesNotMatch" ? "revisá S3_SECRET_ACCESS_KEY" :
    code === "NoSuchBucket" ? "revisá S3_BUCKET" :
    code === "AccessDenied" ? "el token de R2 necesita permiso de lectura y escritura" :
    /region/i.test(message) ? "revisá S3_REGION (para R2 va auto o se deja vacía)" :
    "";
  const detail = [code, message].filter(Boolean).join(": ");
  return `El almacenamiento rechazó el archivo (${status}${detail ? ` · ${detail}` : ""})${hint ? `. ${hint[0].toUpperCase()}${hint.slice(1)}.` : ""}`;
}

/** PUT de un archivo a una URL firmada, informando el progreso. */
function put(url: string, blob: Blob, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(storageError(xhr.status, xhr.responseText))));
    xhr.onerror = () => reject(new Error("Se perdió la conexión (o falta configurar CORS en el bucket)"));
    xhr.send(blob);
  });
}

async function upload(item: Item, batch: BatchOptions, onStatus: (status: Status, progress?: number) => void): Promise<Item["result"]> {
  onStatus("preparing");
  const image = await prepareImage(item.file);

  const { token, originalType, uploads } = await postJson<{ token: string; originalType: string; uploads: { original: string; display: string; thumb: string } }>("/api/upload/start", {
    name: item.file.name,
    size: item.file.size,
    displayType: image.display.type,
    thumbType: image.thumb.type,
  });

  onStatus("uploading", 0);
  await Promise.all([put(uploads.display, image.display), put(uploads.thumb, image.thumb)]);
  // Los RAW llegan sin tipo desde el navegador: le ponemos el que espera la URL firmada
  const original = item.file.slice(0, item.file.size, originalType);
  await put(uploads.original, original, (p) => onStatus("uploading", p));

  onStatus("processing", 1);
  return postJson("/api/upload/complete", {
    token,
    width: image.width,
    height: image.height,
    blurDataUrl: image.blurDataUrl,
    takenAt: image.takenAt,
    ...batch,
  });
}

export function Uploader({ maxMb, categories, themes }: { maxMb: number; categories: { id: string; name: string }[]; themes: string[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  // Por defecto se publican: así lo que sube la fotógrafa aparece enseguida en la galería.
  // Si prefiere revisarlas antes, destilda "Publicar directamente" y quedan como borrador.
  const [batch, setBatch] = useState<BatchOptions>({ categoryId: "", theme: "", tags: "", publish: true });
  const workers = useRef(0);
  const queue = useRef<Item[]>([]);
  const batchRef = useRef(batch);
  batchRef.current = batch;

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  // Arranca hasta PARALLEL "trabajadores" que van tomando fotos de la cola
  function run() {
    while (workers.current < PARALLEL && queue.current.length) {
      workers.current++;
      (async () => {
        while (queue.current.length) {
          const item = queue.current.shift()!;
          patch(item.key, { status: "uploading", error: undefined });
          try {
            const result = await upload(item, batchRef.current, (status, progress) => patch(item.key, { status, ...(progress !== undefined && { progress }) }));
            patch(item.key, { status: "done", progress: 1, result });
          } catch (e) {
            patch(item.key, { status: "error", error: (e as Error).message, progress: 0 });
          }
        }
        workers.current--;
      })();
    }
  }

  function retryFailed() {
    const failed = items.filter((it) => it.status === "error" && it.file.size <= maxMb * 1024 * 1024 && FORMATS[extensionOf(it.file.name)]);
    failed.forEach((it) => patch(it.key, { status: "waiting", error: undefined }));
    queue.current.push(...failed);
    run();
  }

  function add(files: FileList | null) {
    if (!files) return;
    const next = [...files].map((file) => {
      // Los que no se pueden subir quedan en la lista con el motivo
      const error = !FORMATS[extensionOf(file.name)] ? "Formato no admitido" : file.size > maxMb * 1024 * 1024 ? `Supera ${maxMb} MB` : undefined;
      return { key: `${file.name}-${file.size}-${Math.random()}`, file, preview: "", progress: 0, status: (error ? "error" : "waiting") as Status, error };
    });
    setItems((list) => [...next, ...list]);
    queue.current.push(...next.filter((n) => n.status === "waiting"));
    run();
  }

  const labels: Record<Status, string> = {
    waiting: "En cola",
    preparing: "Generando versiones optimizadas",
    uploading: "Subiendo original",
    processing: "Guardando",
    done: "Listo",
    error: "Error",
  };
  const counts = items.reduce((acc, it) => ({ ...acc, [it.status]: (acc[it.status] ?? 0) + 1 }), {} as Partial<Record<Status, number>>);
  const totalBytes = items.reduce((a, it) => a + it.file.size, 0);
  const doneBytes = items.reduce((a, it) => a + it.file.size * (it.status === "done" ? 1 : it.progress), 0);

  return (
    <div>
      {/* Datos que se aplican a todas las fotos de este lote */}
      <div className="mb-8 grid gap-6 border border-line p-6 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end">
        <p className="eyebrow md:col-span-4">Datos del lote · se aplican a cada foto que subas</p>
        <label>
          <span className="eyebrow mb-1 block">Categoría</span>
          <CategorySelect value={batch.categoryId} onChange={(categoryId) => setBatch((b) => ({ ...b, categoryId }))} categories={categories} />
        </label>
        <label>
          <span className="eyebrow mb-1 block">Tema</span>
          <input value={batch.theme} onChange={(e) => setBatch({ ...batch, theme: e.target.value })} list="batch-themes" className={inputClass} />
          <datalist id="batch-themes">{themes.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label>
          <span className="eyebrow mb-1 block">Etiquetas (separadas por coma)</span>
          <input value={batch.tags} onChange={(e) => setBatch({ ...batch, tags: e.target.value })} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-mist">
          <input type="checkbox" checked={batch.publish} onChange={(e) => setBatch({ ...batch, publish: e.target.checked })} className="h-4 w-4 accent-[#d8c3a5]" />
          Publicar directamente
        </label>
      </div>

      <label
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), add(e.dataTransfer.files))}
        className={`flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-20 text-center transition-all duration-500 ${
          drag ? "border-bone bg-white/[0.03]" : "border-white/15 hover:border-white/35"
        }`}
      >
        <input type="file" accept={ACCEPT_ATTRIBUTE} multiple className="sr-only" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        <motion.span animate={{ y: drag ? -6 : 0 }} transition={{ duration: 0.5, ease: EASE_CINE }} className="font-display text-4xl font-light">
          Soltá tus fotografías acá
        </motion.span>
        <span className="mt-4 text-sm text-mist">o hacé click para elegir · RAW (CR2, CR3, NEF, ARW, RAF, DNG…), TIFF, HEIC, JPG, PNG, WebP · hasta {formatBytes(maxMb * 1024 * 1024)} por archivo</span>
        <span className="mt-2 text-xs text-mist">El original se guarda intacto (4K, 8K o más). Se genera automáticamente una versión optimizada para la web.</span>
      </label>

      {items.length > 0 && (
        <div className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="text-sm text-bone">
              {counts.done ?? 0} de {items.length} listas
              <span className="text-mist">
                {" "}· {formatBytes(doneBytes)} de {formatBytes(totalBytes)}
                {counts.waiting ? ` · ${counts.waiting} en cola` : ""}
              </span>
            </p>
            <div className="flex gap-6">
              {!!counts.error && <button onClick={retryFailed} className="eyebrow text-red-300! hover:text-bone!">Reintentar {counts.error} con error</button>}
              {!!counts.done && <TLink href="/estudio/fotos" className="eyebrow hover:text-bone">Ver en el listado →</TLink>}
            </div>
          </div>
          <div className="mt-3 h-px bg-line">
            <motion.div className="h-px bg-accent" animate={{ width: `${totalBytes ? (doneBytes / totalBytes) * 100 : 0}%` }} transition={{ duration: 0.4 }} />
          </div>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        <AnimatePresence initial={false}>
          {/* Mostramos primero las que están en curso o con error, y como máximo VISIBLE_ROWS */}
          {[...items].sort((a, b) => rank(a.status) - rank(b.status)).slice(0, VISIBLE_ROWS).map((it) => (
            <motion.li
              key={it.key}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE_CINE }}
              className="relative flex items-center gap-5 overflow-hidden border border-line p-3"
            >
              <Preview file={it.file} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{it.file.name}</p>
                <p className="mt-1 text-xs text-mist">
                  {formatBytes(it.file.size)}
                  {it.result && ` · ${it.result.width}×${it.result.height}`} · <span className={it.status === "error" ? "text-red-300" : it.status === "done" ? "text-emerald-300/90" : ""}>{it.error ?? labels[it.status]}</span>
                  {it.status === "uploading" && ` ${Math.round(it.progress * 100)}%`}
                </p>
              </div>
              {it.status === "done" && it.result && (
                <TLink href={`/estudio/fotos/${it.result.id}`} className="eyebrow shrink-0 hover:text-bone">Completar datos →</TLink>
              )}
              {(it.status === "processing" || it.status === "preparing") && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border border-mist border-t-bone" />}
              <motion.span
                className="absolute bottom-0 left-0 h-px bg-accent"
                animate={{ width: `${it.progress * 100}%`, opacity: it.status === "done" ? 0 : 1 }}
                transition={{ duration: 0.3 }}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length > VISIBLE_ROWS && <p className="mt-4 text-xs text-mist">Y {items.length - VISIBLE_ROWS} más…</p>}
    </div>
  );
}

const rank = (s: Status) => ({ preparing: 0, uploading: 0, processing: 0, error: 1, waiting: 2, done: 3 })[s];

/** Vista previa liviana: se crea al mostrarse y se libera al desaparecer (evita gastar memoria con cientos de archivos). */
function Preview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  // RAW, TIFF o HEIC: el navegador no los muestra, ponemos el formato
  if (failed) return <span className="flex h-16 w-16 shrink-0 items-center justify-center bg-smoke text-[10px] tracking-widest text-mist uppercase">{extensionOf(file.name)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" onError={() => setFailed(true)} className="h-16 w-16 shrink-0 object-cover" /> : <span className="h-16 w-16 shrink-0 bg-smoke" />;
}
