"use client";

import { useEffect, useRef, useState } from "react";
import { resolveHeroFit, type HeroFit } from "@/lib/hero";
import { CENTER, clampPercent, focusToCss, type Focus } from "@/lib/focus";
import { focusFromUrl } from "@/lib/client-focus";
import { saveDetectedFocus } from "@/app/admin/actions";
import { Label } from "./ui";

/*
 * Elegir la foto de portada, cómo se acomoda y su encuadre, viendo en
 * miniatura cómo va a quedar en una computadora y en un celular.
 *
 * El punto de enfoque (lo importante de la foto, que queda siempre a la vista
 * cuando se recorta) se detecta solo (lib/focus.ts). Si quedó mal se corrige
 * de dos formas: tocando lo importante en la foto completa, o arrastrando la
 * foto dentro de las vistas previas. Se guarda en la foto al apretar "Guardar".
 *
 * Las fotos subidas antes de que existiera la detección no tienen enfoque:
 * al abrir esta página se calcula el de cada una (en este navegador) y se guarda.
 */

export interface HeroCandidate {
  id: string;
  title: string;
  thumbUrl: string;
  /** La misma miniatura servida desde este sitio (/media/…): el navegador sólo deja leer píxeles del mismo dominio. */
  localThumbUrl: string;
  blurDataUrl: string;
  width: number;
  height: number;
  focusX: number | null;
  focusY: number | null;
}

const FIT_OPTIONS: { value: HeroFit; label: string; note: string }[] = [
  { value: "auto", label: "Automático", note: "Llena la pantalla mostrando lo importante de la foto; sólo si es muy chica la muestra entera" },
  { value: "cover", label: "Llenar pantalla", note: "Siempre a pantalla completa, recortando lo que no entra" },
  { value: "contain", label: "Foto entera", note: "Siempre entera, sobre un fondo desenfocado de la misma foto" },
];

// Pantallas de referencia para las vistas previas
const SCREENS = [
  { label: "Computadora", width: 1920, height: 1080, previewWidth: 440 },
  { label: "Celular", width: 390, height: 844, previewWidth: 130 },
];

type Origin = "auto" | "manual";

export function HeroPicker({
  photos, heroPhotoId, heroFit,
}: { photos: HeroCandidate[]; heroPhotoId: string; heroFit: HeroFit }) {
  const [photoId, setPhotoId] = useState(heroPhotoId);
  const [fit, setFit] = useState<HeroFit>(heroFit);
  // Enfoque de cada foto (el guardado, o el que se va calculando o corrigiendo acá)
  const [focuses, setFocuses] = useState<Record<string, Focus | null>>(() =>
    Object.fromEntries(photos.map((p) => [p.id, p.focusX == null || p.focusY == null ? null : { x: p.focusX, y: p.focusY }])),
  );
  // De dónde salió el enfoque que se ve ahora (para explicarlo debajo)
  const [origins, setOrigins] = useState<Record<string, Origin>>({});
  const [pending, setPending] = useState(() => photos.filter((p) => p.focusX == null || p.focusY == null).length);

  // "Automática" usa la primera destacada: la primera de la lista (vienen ordenadas así)
  const current = photos.find((p) => p.id === photoId) ?? photos[0];
  const focus = (current && focuses[current.id]) ?? CENTER;

  const setFocus = (id: string, f: Focus, origin: Origin) => {
    setFocuses((all) => ({ ...all, [id]: { x: clampPercent(f.x), y: clampPercent(f.y) } }));
    setOrigins((all) => ({ ...all, [id]: origin }));
  };

  // Calcula y guarda el enfoque de las fotos que todavía no lo tienen (de a una, sin trabar la página).
  // Se hace una sola vez al abrir la página: lo que se guarda acá no vuelve a faltar.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const missing = photos.filter((p) => p.focusX == null || p.focusY == null);
    if (!missing.length) return;
    (async () => {
      let batch: { id: string; x: number; y: number }[] = [];
      for (const p of missing) {
        try {
          const f = await focusFromUrl(p.localThumbUrl);
          setFocuses((all) => (all[p.id] ? all : { ...all, [p.id]: f }));
          setOrigins((all) => (all[p.id] ? all : { ...all, [p.id]: "auto" }));
          batch.push({ id: p.id, ...f });
        } catch {
          // Si una miniatura no abre, esa foto sigue centrada
        }
        setPending((n) => n - 1);
        if (batch.length >= 12) {
          await saveDetectedFocus(batch).catch(() => {});
          batch = [];
        }
      }
      if (batch.length) await saveDetectedFocus(batch).catch(() => {});
    })();
  }, [photos]);

  const redetect = async () => {
    if (!current) return;
    try {
      setFocus(current.id, await focusFromUrl(current.localThumbUrl), "auto");
    } catch {
      // nada: queda como estaba
    }
  };

  const pickFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!current) return;
    const box = e.currentTarget.getBoundingClientRect();
    setFocus(current.id, { x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 }, "manual");
  };

  const origin = current ? origins[current.id] : undefined;

  return (
    <div className="space-y-10">
      <fieldset>
        <Label className="mb-4">Fotografía de portada (destacadas y más recientes; para otra, marcala como destacada)</Label>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          <label className="relative flex aspect-square cursor-pointer items-center justify-center border border-line text-center text-xs text-mist has-[:checked]:border-bone has-[:checked]:text-bone">
            <input type="radio" name="heroPhotoId" value="" checked={photoId === ""} onChange={() => setPhotoId("")} className="sr-only" />
            Automática<br />(primera destacada)
          </label>
          {photos.map((p) => (
            <label key={p.id} className="group relative aspect-square cursor-pointer overflow-hidden bg-smoke ring-offset-2 ring-offset-ink has-[:checked]:ring-1 has-[:checked]:ring-bone">
              <input type="radio" name="heroPhotoId" value={p.id} checked={photoId === p.id} onChange={() => setPhotoId(p.id)} className="sr-only" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumbUrl}
                alt={p.title}
                loading="lazy"
                className="h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-100 group-has-[:checked]:opacity-100"
                style={{ objectPosition: focusToCss(focuses[p.id] ?? CENTER) }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <Label className="mb-4">Cómo se acomoda en la pantalla</Label>
        <div className="grid gap-3 md:grid-cols-3">
          {FIT_OPTIONS.map((o) => (
            <label key={o.value} className="cursor-pointer border border-line p-4 transition-colors has-[:checked]:border-bone">
              <input type="radio" name="heroFit" value={o.value} checked={fit === o.value} onChange={() => setFit(o.value)} className="sr-only" />
              <span className="block text-sm text-bone">{o.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-mist">{o.note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {current && (
        <div>
          <Label className="mb-2">Encuadre</Label>
          <p className="mb-5 max-w-2xl text-xs leading-relaxed text-mist">
            Lo importante de la foto se detecta solo. Si no quedó bien, tocá lo importante en la foto completa o
            arrastrá la foto dentro de las vistas previas, y guardá.
          </p>
          <input type="hidden" name="focusPhotoId" value={current.id} />
          <input type="hidden" name="focus" value={focusToCss(focus)} />

          <div className="flex flex-wrap items-end gap-8">
            <figure>
              <button
                type="button"
                onClick={pickFocus}
                className="relative block cursor-crosshair overflow-hidden bg-smoke"
                style={{ height: 248, aspectRatio: `${current.width} / ${current.height}`, maxWidth: 440 }}
                title="Tocá lo importante de la foto"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={current.thumbUrl} alt={current.title} className="h-full w-full object-cover" draggable={false} />
                <span
                  className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)] transition-all duration-300"
                  style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
                />
              </button>
              <figcaption className="eyebrow mt-2">Tocá lo importante</figcaption>
            </figure>

            {SCREENS.map((s) => (
              <figure key={s.label}>
                <Preview photo={current} fit={fit} focus={focus} screen={s} onMove={(f) => setFocus(current.id, f, "manual")} />
                <figcaption className="eyebrow mt-2">
                  {s.label} · {resolveHeroFit(fit, current, s) === "cover" ? "arrastrá para acomodar" : "foto entera"}
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-6 text-xs text-mist">
            <span>
              {focuses[current.id] == null
                ? "Detectando lo importante de la foto…"
                : origin === "manual"
                  ? "Ajustado a mano. Guardá para aplicarlo."
                  : origin === "auto"
                    ? "Detectado automáticamente."
                    : "Encuadre guardado."}
            </span>
            <button type="button" onClick={redetect} className="eyebrow underline-offset-4 transition-colors hover:text-bone hover:underline">
              Volver a detectar automáticamente
            </button>
            {pending > 0 && <span>Calculando el encuadre de {pending} foto{pending === 1 ? "" : "s"}…</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Miniatura del hero: la misma disposición que components/home/Hero.tsx, a escala.
 * Cuando la foto llena la pantalla se puede arrastrar para moverla: eso cambia el
 * punto de enfoque (object-position) igual que en la portada real.
 */
function Preview({
  photo, fit, focus, screen, onMove,
}: { photo: HeroCandidate; fit: HeroFit; focus: Focus; screen: (typeof SCREENS)[number]; onMove: (f: Focus) => void }) {
  const mode = resolveHeroFit(fit, photo, screen);
  const desktop = screen.width >= 768;
  const vertical = photo.height >= photo.width;
  const drag = useRef<{ px: number; py: number; fx: number; fy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Cuánto sobra de foto (en píxeles de la vista previa) a lo ancho y a lo alto con "cover"
  const frameW = screen.previewWidth;
  const frameH = (frameW * screen.height) / screen.width;
  const ratio = photo.width / photo.height;
  const wider = ratio > frameW / frameH;
  const extraX = wider ? frameH * ratio - frameW : 0;
  const extraY = wider ? 0 : frameW / ratio - frameH;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "cover") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, fx: focus.x, fy: focus.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    // Arrastrar la foto hacia abajo muestra más de su parte de arriba (el enfoque sube), y lo mismo de costado
    onMove({
      x: extraX > 1 ? d.fx - ((e.clientX - d.px) / extraX) * 100 : d.fx,
      y: extraY > 1 ? d.fy - ((e.clientY - d.py) / extraY) * 100 : d.fy,
    });
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  // Mismos márgenes que el hero en modo "foto entera", como porcentaje de la pantalla de referencia
  const box = !desktop
    ? { left: "6%", right: "6%", top: "11%", bottom: "46%" }
    : vertical
      ? { left: "42%", right: "3.3%", top: "8.9%", bottom: "18%" }
      : { left: "3.3%", right: "3.3%", top: "8.9%", bottom: "38%" };

  return (
    <div
      className={`relative touch-none overflow-hidden border border-line bg-ink select-none ${mode === "cover" ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
      style={{ width: frameW, height: frameH }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {mode === "cover" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.thumbUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ objectPosition: focusToCss(focus) }} />
      ) : (
        <>
          <div
            className="absolute -inset-[10%]"
            style={{ backgroundImage: `url(${photo.blurDataUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(10px) brightness(0.6) saturate(1.2)" }}
          />
          <div className={`absolute flex items-center ${desktop && vertical ? "justify-end" : "justify-center"}`} style={box}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.thumbUrl} alt="" draggable={false} className="max-h-full max-w-full object-contain shadow-lg" />
          </div>
        </>
      )}
      <div className="pointer-events-none absolute inset-0 bg-black/25" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />
      <span className="pointer-events-none absolute bottom-[12%] left-[6%] font-display text-bone" style={{ fontSize: frameW / (desktop ? 9 : 5) }}>
        Delfina
      </span>
    </div>
  );
}
