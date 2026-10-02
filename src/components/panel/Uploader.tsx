"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { TLink } from "@/components/motion/PageTransition";
import { EASE_CINE } from "@/components/motion/easing";
import { formatBytes } from "@/lib/utils";

/*
 * Subida de fotos con progreso real.
 * Usamos XMLHttpRequest (y no fetch) porque es la única API del navegador que
 * informa el progreso de SUBIDA (xhr.upload.onprogress). Las fotos se suben
 * de a una, para no saturar la conexión con varios archivos de cientos de MB.
 */

type Status = "waiting" | "uploading" | "processing" | "done" | "error";
interface Item {
  key: string;
  file: File;
  preview: string;
  progress: number;
  status: Status;
  result?: { id: string; width: number; height: number };
  error?: string;
}

const ACCEPT = "image/jpeg,image/png,image/tiff,image/webp,image/avif";

function upload(item: Item, onProgress: (p: number) => void): Promise<Item["result"]> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("Content-Type", item.file.type);
    xhr.setRequestHeader("X-Filename", encodeURIComponent(item.file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error ?? "Error al subir"));
    };
    xhr.onerror = () => reject(new Error("Se perdió la conexión"));
    xhr.send(item.file);
  });
}

export function Uploader({ maxMb }: { maxMb: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const running = useRef(false);
  const queue = useRef<Item[]>([]);

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function run() {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const item = queue.current.shift()!;
      patch(item.key, { status: "uploading" });
      try {
        const result = await upload(item, (progress) => patch(item.key, { progress, status: progress >= 1 ? "processing" : "uploading" }));
        patch(item.key, { status: "done", progress: 1, result });
      } catch (e) {
        patch(item.key, { status: "error", error: (e as Error).message });
      }
    }
    running.current = false;
  }

  function add(files: FileList | null) {
    if (!files) return;
    const next = [...files]
      .filter((f) => ACCEPT.includes(f.type))
      .map((file) => ({
        key: `${file.name}-${file.size}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: (file.size > maxMb * 1024 * 1024 ? "error" : "waiting") as Status,
        error: file.size > maxMb * 1024 * 1024 ? `Supera ${maxMb} MB` : undefined,
      }));
    setItems((list) => [...next, ...list]);
    queue.current.push(...next.filter((n) => n.status === "waiting"));
    run();
  }

  const labels: Record<Status, string> = {
    waiting: "En cola",
    uploading: "Subiendo original",
    processing: "Generando versiones optimizadas",
    done: "Listo · borrador",
    error: "Error",
  };

  return (
    <div>
      <label
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), add(e.dataTransfer.files))}
        className={`flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-20 text-center transition-all duration-500 ${
          drag ? "border-bone bg-white/[0.03]" : "border-white/15 hover:border-white/35"
        }`}
      >
        <input type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        <motion.span animate={{ y: drag ? -6 : 0 }} transition={{ duration: 0.5, ease: EASE_CINE }} className="font-display text-4xl font-light">
          Soltá tus fotografías acá
        </motion.span>
        <span className="mt-4 text-sm text-mist">o hacé click para elegir · JPG, PNG, TIFF, WebP, AVIF · hasta {formatBytes(maxMb * 1024 * 1024)} por archivo</span>
        <span className="mt-2 text-xs text-mist">El original se guarda intacto (4K, 8K o más). Se genera automáticamente una versión optimizada para la web.</span>
      </label>

      <ul className="mt-10 space-y-3">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.li
              key={it.key}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE_CINE }}
              className="relative flex items-center gap-5 overflow-hidden border border-line p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.preview} alt="" className="h-16 w-16 shrink-0 object-cover" />
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
              {it.status === "processing" && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border border-mist border-t-bone" />}
              <motion.span
                className="absolute bottom-0 left-0 h-px bg-accent"
                animate={{ width: `${it.progress * 100}%`, opacity: it.status === "done" ? 0 : 1 }}
                transition={{ duration: 0.3 }}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
