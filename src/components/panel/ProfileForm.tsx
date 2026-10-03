import type { Settings } from "@/lib/settings";
import { updateProfile } from "@/app/estudio/perfil/actions";
import { ActionForm } from "./ActionForm";
import { Label, inputClass } from "./ui";

/*
 * Formulario del perfil público de la fotógrafa. Se usa en Estudio → Perfil
 * (fotógrafa) y en Administración → Fotógrafa (administrador).
 * Los campos que se dejan vacíos no aparecen en el sitio.
 */
const SOCIALS: { key: keyof Settings; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/usuario" },
  { key: "whatsapp", label: "WhatsApp (con código de país)", placeholder: "+54 9 261 123 4567" },
  { key: "phone", label: "Teléfono", placeholder: "+54 261 123 4567" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/pagina" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@usuario" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@canal" },
  { key: "behance", label: "Behance", placeholder: "https://behance.net/usuario" },
  { key: "website", label: "Otro sitio web", placeholder: "https://…" },
];

export function ProfileForm({ settings: s }: { settings: Settings }) {
  return (
    <ActionForm action={updateProfile} submitLabel="Guardar perfil" className="space-y-14">
      <section className="grid gap-8 md:grid-cols-2">
        <p className="eyebrow md:col-span-2">Presentación</p>
        <label><Label>Nombre público</Label><input name="photographerName" defaultValue={s.photographerName} required className={`${inputClass} font-display text-2xl!`} /></label>
        <label><Label>Bajada</Label><input name="tagline" defaultValue={s.tagline} className={inputClass} /></label>
        <label className="md:col-span-2"><Label>Biografía (aparece en la portada)</Label><textarea name="bio" defaultValue={s.bio} rows={3} className={`${inputClass} resize-none`} /></label>
        <label><Label>Ubicación</Label><input name="location" defaultValue={s.location} className={inputClass} /></label>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <p className="eyebrow md:col-span-2">Contacto · lo vacío no se muestra</p>
        <label><Label>Email de contacto</Label><input name="contactEmail" type="email" defaultValue={s.contactEmail} className={inputClass} /></label>
        <label><Label>Texto de la página de contacto</Label><input name="contactIntro" defaultValue={s.contactIntro} className={inputClass} /></label>
        {SOCIALS.map((f) => (
          <label key={f.key}><Label>{f.label}</Label><input name={f.key} defaultValue={s[f.key]} placeholder={f.placeholder} className={inputClass} /></label>
        ))}
      </section>
    </ActionForm>
  );
}
