import { db } from "@/lib/db";
import { ROLES, type Role } from "@/lib/permissions";
import { PanelTitle, Stat } from "@/components/panel/ui";
import { StorageMeter } from "@/components/panel/StorageMeter";

const PLURAL: Record<Role, string> = { USER: "Usuarios", PHOTOGRAPHER: "Fotógrafas", ADMIN: "Administradores" };

export default async function AdminHome() {
  const [byRole, photos, drafts, categories, messages, inactive] = await Promise.all([
    db.user.groupBy({ by: ["role"], _count: true }),
    db.photo.count(),
    db.photo.count({ where: { published: false } }),
    db.category.count(),
    db.contactMessage.count(),
    db.user.count({ where: { active: false } }),
  ]);
  const count = (r: Role) => byRole.find((b) => b.role === r)?._count ?? 0;

  return (
    <>
      <PanelTitle eyebrow="Administración" title="Resumen" />
      <div className="mb-12 max-w-2xl"><StorageMeter /></div>
      <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((r) => <Stat key={r} label={PLURAL[r]} value={count(r)} />)}
        <Stat label="Fotografías" value={photos} note={`${drafts} en borrador`} />
        <Stat label="Categorías" value={categories} />
        <Stat label="Mensajes" value={messages} />
        <Stat label="Cuentas desactivadas" value={inactive} />
      </div>
    </>
  );
}
