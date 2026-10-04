import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";
import { UserRowForm } from "@/components/panel/UserRowForm";
import { formatDate } from "@/lib/utils";
import { Label, PanelTitle, inputClass, selectClass } from "@/components/panel/ui";
import { ConfirmButton } from "@/components/panel/ConfirmButton";
import { ActionForm } from "@/components/panel/ActionForm";
import { createUser, deleteUser } from "../actions";

export default async function UsersPage() {
  const [me, users] = await Promise.all([
    getCurrentUser(),
    // Orden fijo por antigüedad: al cambiar un rol, la fila no salta de lugar
    db.user.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { favorites: true, photos: true } } } }),
  ]);

  return (
    <>
      <PanelTitle eyebrow="Administración" title="Usuarios" />

      <div className="divide-y divide-line border-y border-line">
        {users.map((u) => (
          <div key={u.id} className={`flex flex-col gap-4 py-5 xl:flex-row xl:items-center ${u.active ? "" : "opacity-50"}`}>
            <div className="min-w-0 xl:w-72">
              <p className="truncate font-display text-xl">{u.name} {u.id === me?.id && <span className="eyebrow ml-2">(vos)</span>}</p>
              <p className="truncate text-xs text-mist">{u.email} · desde {formatDate(u.createdAt, "short")} · {u._count.favorites} favoritos{u._count.photos ? ` · ${u._count.photos} fotos subidas` : ""}</p>
            </div>
            <UserRowForm user={{ id: u.id, role: u.role, active: u.active, canDownload: u.canDownload }} isSelf={u.id === me?.id} />
            {u.id !== me?.id && (
              <form action={deleteUser}>
                <input type="hidden" name="id" value={u.id} />
                <ConfirmButton variant="ghost" message={`¿Eliminar la cuenta de ${u.name}? Se borran también sus favoritos.`}>Eliminar</ConfirmButton>
              </form>
            )}
          </div>
        ))}
      </div>

      <div className="mt-16">
        <p className="eyebrow mb-6">Crear usuario</p>
        <ActionForm action={createUser} submitLabel="Crear usuario" resetOnSuccess className="border border-line p-6">
          <div className="grid gap-8 md:grid-cols-4">
            <label><Label>Nombre</Label><input name="name" required className={inputClass} /></label>
            <label><Label>Email</Label><input name="email" type="email" required className={inputClass} /></label>
            <label><Label>Contraseña</Label><input name="password" type="password" required minLength={8} className={inputClass} /></label>
            <label>
              <Label>Rol</Label>
              <select name="role" defaultValue="USER" className={selectClass}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </label>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
