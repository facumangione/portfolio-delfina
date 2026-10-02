import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Label, PanelTitle, inputClass } from "@/components/panel/ui";
import { ActionForm } from "@/components/panel/ActionForm";
import { updateSettings } from "../actions";

// Perfil público de la fotógrafa + cuentas con rol de fotógrafa.
export default async function PhotographerPage() {
  const [s, photographers] = await Promise.all([
    getSettings(),
    db.user.findMany({ where: { role: "PHOTOGRAPHER" }, include: { _count: { select: { photos: true } } } }),
  ]);

  return (
    <>
      <PanelTitle eyebrow="Administración" title="Fotógrafa" />

      <ActionForm action={updateSettings} submitLabel="Guardar perfil" className="space-y-8">
        <div className="grid gap-8 md:grid-cols-2">
          <label><Label>Nombre público</Label><input name="photographerName" defaultValue={s.photographerName} className={`${inputClass} font-display text-2xl!`} /></label>
          <label><Label>Bajada</Label><input name="tagline" defaultValue={s.tagline} className={inputClass} /></label>
          <label className="md:col-span-2"><Label>Biografía (aparece en la portada)</Label><textarea name="bio" defaultValue={s.bio} rows={3} className={`${inputClass} resize-none`} /></label>
          <label><Label>Ubicación</Label><input name="location" defaultValue={s.location} className={inputClass} /></label>
          <label><Label>Email de contacto</Label><input name="contactEmail" type="email" defaultValue={s.contactEmail} className={inputClass} /></label>
          <label><Label>Instagram (URL)</Label><input name="instagram" defaultValue={s.instagram} className={inputClass} /></label>
          <label><Label>Behance u otro sitio (URL)</Label><input name="behance" defaultValue={s.behance} className={inputClass} /></label>
        </div>
      </ActionForm>

      <div className="mt-16">
        <p className="eyebrow mb-4">Cuentas con rol de fotógrafa</p>
        <ul className="divide-y divide-line border-y border-line">
          {photographers.map((p) => (
            <li key={p.id} className="flex justify-between py-4 text-sm">
              <span>{p.name} <span className="text-mist">· {p.email}</span></span>
              <span className="text-mist">{p._count.photos} fotos subidas · {p.active ? "activa" : "desactivada"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-mist">Para dar o quitar el rol, usá la sección Usuarios.</p>
      </div>
    </>
  );
}
