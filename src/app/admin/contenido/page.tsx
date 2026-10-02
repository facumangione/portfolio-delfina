import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { publicUrl } from "@/lib/storage";
import { Label, PanelTitle, inputClass } from "@/components/panel/ui";
import { ActionForm } from "@/components/panel/ActionForm";
import { updateSettings } from "../actions";

// Textos del sitio y foto de portada (hero).
export default async function ContentPage() {
  const [s, photos] = await Promise.all([
    getSettings(),
    db.photo.findMany({ where: { published: true }, orderBy: [{ featured: "desc" }, { takenAt: "desc" }] }),
  ]);

  return (
    <>
      <PanelTitle eyebrow="Administración" title="Contenido" />
      <ActionForm action={updateSettings} submitLabel="Guardar contenido" className="space-y-10">
        <label className="block"><Label>Texto de portada</Label><textarea name="heroText" defaultValue={s.heroText} rows={2} className={`${inputClass} resize-none`} /></label>
        <label className="block"><Label>Introducción de la página de contacto</Label><textarea name="contactIntro" defaultValue={s.contactIntro} rows={2} className={`${inputClass} resize-none`} /></label>

        <fieldset>
          <Label className="mb-4">Fotografía de portada</Label>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            <label className="relative flex aspect-square cursor-pointer items-center justify-center border border-line text-center text-xs text-mist has-[:checked]:border-bone has-[:checked]:text-bone">
              <input type="radio" name="heroPhotoId" value="" defaultChecked={!s.heroPhotoId} className="sr-only" />
              Automática<br />(primera destacada)
            </label>
            {photos.map((p) => (
              <label key={p.id} className="group relative aspect-square cursor-pointer overflow-hidden bg-smoke ring-offset-2 ring-offset-ink has-[:checked]:ring-1 has-[:checked]:ring-bone">
                <input type="radio" name="heroPhotoId" value={p.id} defaultChecked={s.heroPhotoId === p.id} className="sr-only" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicUrl(p.thumbPath)} alt={p.title} className="h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-100 group-has-[:checked]:opacity-100" />
              </label>
            ))}
          </div>
        </fieldset>
      </ActionForm>
    </>
  );
}
