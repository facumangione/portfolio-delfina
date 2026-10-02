import { db } from "@/lib/db";
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES, type Permission } from "@/lib/permissions";
import { PanelTitle } from "@/components/panel/ui";
import { TLink } from "@/components/motion/PageTransition";

// Matriz de permisos por rol. Los permisos de cada rol están definidos en
// src/lib/permissions.ts; por usuario se puede cambiar el rol, desactivar la
// cuenta o quitarle la descarga desde "Usuarios".
export default async function PermissionsPage() {
  const restricted = await db.user.findMany({ where: { OR: [{ canDownload: false }, { active: false }] }, select: { id: true, name: true, active: true, canDownload: true } });

  return (
    <>
      <PanelTitle eyebrow="Administración" title="Permisos" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow py-4 text-left font-normal">Permiso</th>
              {ROLES.map((r) => <th key={r} className="eyebrow w-32 py-4 font-normal">{ROLE_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
              <tr key={p} className="border-b border-line">
                <td className="py-4 pr-6">
                  <span className="text-bone">{PERMISSIONS[p]}</span>
                  <span className="ml-3 font-mono text-[10px] text-mist">{p}</span>
                </td>
                {ROLES.map((r) => (
                  <td key={r} className="py-4 text-center">
                    {ROLE_PERMISSIONS[r].includes(p) ? <span className="text-accent">●</span> : <span className="text-white/15">○</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-14">
        <p className="eyebrow mb-4">Restricciones individuales</p>
        {restricted.length === 0 ? (
          <p className="text-sm text-mist">Ningún usuario tiene restricciones.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {restricted.map((u) => (
              <li key={u.id} className="flex justify-between py-3 text-sm">
                <span>{u.name}</span>
                <span className="text-mist">{[!u.active && "Cuenta desactivada", !u.canDownload && "Sin descargas"].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
        <TLink href="/admin/usuarios" className="eyebrow mt-4 inline-block hover:text-bone">Gestionar en Usuarios →</TLink>
      </div>
    </>
  );
}
