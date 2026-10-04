"use client";

import { useViewer } from "@/components/ViewerProvider";
import { cn, formatBytes } from "@/lib/utils";

/*
 * La descarga del ORIGINAL pasa siempre por /api/photos/[id]/download, que
 * verifica sesión y permisos antes de entregar el archivo. Si la foto no es
 * descargable, el botón no se muestra.
 */
export function DownloadButton({
  photoId, downloadable, size, className, withLabel, web,
}: { photoId: string; downloadable: boolean; size?: number; className?: string; withLabel?: boolean; web?: boolean }) {
  // web: el original se archivó y se descarga la versión de 2400 px
  const label = web ? "Descargar" : "Descargar original";
  const { viewer } = useViewer();
  if (!downloadable || (viewer && !viewer.canDownload)) return null;

  const href = viewer
    ? `/api/photos/${photoId}/download`
    : `/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/galeria")}`;

  return (
    <a
      href={href}
      data-control
      onClick={(e) => e.stopPropagation()}
      className={cn("group/dl inline-flex items-center gap-2.5 text-bone", className)}
      aria-label={label}
      title={viewer ? label : "Ingresá para descargar"}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-500 group-hover/dl:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth={1.2}>
        <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
      </svg>
      {withLabel && (
        <span className="eyebrow text-bone/80! transition-colors group-hover/dl:text-bone!">
          {label}{size ? ` · ${formatBytes(size)}` : ""}
        </span>
      )}
    </a>
  );
}
