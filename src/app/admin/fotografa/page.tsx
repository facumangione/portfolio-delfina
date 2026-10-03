import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PanelTitle } from "@/components/panel/ui";
import { ProfileForm } from "@/components/panel/ProfileForm";

// Perfil público de la fotógrafa (el mismo formulario que ella ve en Estudio → Perfil)
// + cuentas con rol de fotógrafa.
export default async function PhotographerPage() {
  const [s, photographers] = await Promise.all([
    getSettings(),
    db.user.findMany({ where: { role: "PHOTOGRAPHER" }, include: { _count: { select: { photos: true } } } }),
  ]);

  return (
    <>
      <PanelTitle eyebrow="Administración" title="Fotógrafa" />

      <ProfileForm settings={s} />

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
