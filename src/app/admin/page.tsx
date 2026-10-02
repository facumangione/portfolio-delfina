import { db } from "@/lib/db";
import { ROLES, type Role } from "@/lib/permissions";
import { formatBytes } from "@/lib/utils";
import { PanelTitle, Stat } from "@/components/panel/ui";

const PLURAL: Record<Role, string> = { USER: "Usuarios", PHOTOGRAPHER: "Fotógrafas", ADMIN: "Administradores" };

export default async function AdminHome() {
  const [byRole, photos, drafts, categories, messages, storage, inactive] = await Promise.all([
    db.user.groupBy({ by: ["role"], _count: true }),
    db.photo.count(),
    db.photo.count({ where: { published: false } }),
    db.category.count(),
    db.contactMessage.count(),
    db.photo.aggregate({ _sum: { originalSize: true, displaySize: true } }),
    db.user.count({ where: { active: false } }),
  ]);
  const count = (r: Role) => byRole.find((b) => b.role === r)?._count ?? 0;

  return (
    <>
      <PanelTitle eyebrow="Administración" title="Resumen" />
      <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((r) => <Stat key={r} label={PLURAL[r]} value={count(r)} />)}
        <Stat label="Fotografías" value={photos} note={`${drafts} en borrador`} />
        <Stat label="Categorías" value={categories} />
        <Stat label="Mensajes" value={messages} />
        <Stat label="Originales" value={formatBytes(storage._sum.originalSize ?? 0)} note={`Optimizadas: ${formatBytes(storage._sum.displaySize ?? 0)}`} />
        <Stat label="Cuentas desactivadas" value={inactive} />
      </div>
    </>
  );
}
