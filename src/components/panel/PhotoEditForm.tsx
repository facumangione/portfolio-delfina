"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useActionState, useEffect, useState } from "react";
import { updatePhoto } from "@/app/estudio/actions";
import { Button, Label, Toggle, inputClass, selectClass } from "./ui";

interface Props {
  photo: {
    id: string; title: string; description: string; takenAt: string; categoryId: string; theme: string;
    location: string; camera: string; tags: string; published: boolean; featured: boolean; downloadable: boolean;
  };
  categories: { id: string; name: string }[];
  themes: string[];
  tags: string[];
}

export function PhotoEditForm({ photo, categories, themes, tags }: Props) {
  const [state, action, pending] = useActionState(updatePhoto, undefined);
  const [saved, setSaved] = useState(false);
  const [tagValue, setTagValue] = useState(photo.tags);

  useEffect(() => {
    if (state?.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const current = tagValue.split(",").map((t) => t.trim()).filter(Boolean);
  const suggestions = tags.filter((t) => !current.includes(t)).slice(0, 14);

  return (
    <form action={action} className="space-y-9">
      <input type="hidden" name="id" value={photo.id} />
      <label className="block"><Label>Título</Label><input name="title" defaultValue={photo.title} required className={`${inputClass} font-display text-2xl!`} /></label>
      <label className="block"><Label>Descripción</Label><textarea name="description" defaultValue={photo.description} rows={3} className={`${inputClass} resize-none`} /></label>

      <div className="grid gap-9 md:grid-cols-2">
        <label className="block"><Label>Fecha de la toma</Label><input type="date" name="takenAt" defaultValue={photo.takenAt} className={`${inputClass} [color-scheme:dark]`} /></label>
        <label className="block">
          <Label>Categoría</Label>
          <select name="categoryId" defaultValue={photo.categoryId} className={selectClass}>
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <Label>Tema</Label>
          <input name="theme" defaultValue={photo.theme} list="themes" placeholder="Ej.: Hora dorada" className={inputClass} />
          <datalist id="themes">{themes.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label className="block"><Label>Lugar</Label><input name="location" defaultValue={photo.location} className={inputClass} /></label>
        <label className="block md:col-span-2"><Label>Cámara y lente</Label><input name="camera" defaultValue={photo.camera} className={inputClass} /></label>
      </div>

      <div>
        <label className="block">
          <Label>Etiquetas (separadas por coma)</Label>
          <input name="tags" value={tagValue} onChange={(e) => setTagValue(e.target.value)} className={inputClass} />
        </label>
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTagValue([...current, t].join(", "))}
                className="rounded-full border border-line px-2.5 py-0.5 text-xs text-mist transition-colors hover:border-bone/40 hover:text-bone"
              >
                + {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 border-t border-line pt-8 md:grid-cols-3">
        <Toggle name="published" defaultChecked={photo.published} label="Publicada" hint="Visible en el sitio" />
        <Toggle name="featured" defaultChecked={photo.featured} label="Destacada" hint="Aparece en la portada" />
        <Toggle name="downloadable" defaultChecked={photo.downloadable} label="Descargable" hint="Permite bajar el original" />
      </div>

      <div className="flex items-center gap-6">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
        <AnimatePresence>
          {saved && <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="eyebrow text-emerald-300/90!">Guardado</motion.span>}
          {state?.error && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-300">{state.error}</motion.span>}
        </AnimatePresence>
      </div>
    </form>
  );
}
