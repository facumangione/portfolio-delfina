import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { publicUrl } from "@/lib/storage";
import { Label, PanelTitle, inputClass } from "@/components/panel/ui";
import { HeroPicker } from "@/components/panel/HeroPicker";
import { parseHeroFit } from "@/lib/hero";
import { ActionForm } from "@/components/panel/ActionForm";
import { updateSettings } from "../actions";

// Textos del sitio y foto de portada (hero): cuál, cómo se acomoda y su encuadre.
export default async function ContentPage() {
  const [s, photos] = await Promise.all([
    getSettings(),
    // Con cientos de fotos mostramos sólo las destacadas y las más recientes como candidatas
    db.photo.findMany({ where: { published: true }, orderBy: [{ featured: "desc" }, { takenAt: "desc" }], take: 48 }),
  ]);

  return (
    <>
      <PanelTitle eyebrow="Administración" title="Contenido" />
      <ActionForm action={updateSettings} submitLabel="Guardar contenido" className="space-y-10">
        <label className="block"><Label>Texto de portada</Label><textarea name="heroText" defaultValue={s.heroText} rows={2} className={`${inputClass} resize-none`} /></label>
        <label className="block"><Label>Introducción de la página de contacto</Label><textarea name="contactIntro" defaultValue={s.contactIntro} rows={2} className={`${inputClass} resize-none`} /></label>

        <HeroPicker
          photos={photos.map((p) => ({
            id: p.id,
            title: p.title,
            thumbUrl: publicUrl(p.thumbPath),
            localThumbUrl: `/media/${p.thumbPath}`,
            blurDataUrl: p.blurDataUrl,
            width: p.width,
            height: p.height,
            focusX: p.focusX,
            focusY: p.focusY,
          }))}
          heroPhotoId={s.heroPhotoId}
          heroFit={parseHeroFit(s.heroFit)}
        />
      </ActionForm>
    </>
  );
}
