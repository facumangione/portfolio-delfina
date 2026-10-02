import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { PanelShell } from "@/components/panel/PanelShell";

export const dynamic = "force-dynamic";

// Todo lo que está bajo /estudio exige el permiso "photos.manage"
// (fotógrafa o administrador). Si no, redirige al login o al inicio.
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("photos.manage", "/estudio");
  const unread = await db.contactMessage.count({ where: { read: false } });
  return (
    <PanelShell
      title="Estudio"
      links={[
        { href: "/estudio", label: "Resumen" },
        { href: "/estudio/fotos", label: "Fotografías" },
        { href: "/estudio/subir", label: "Subir" },
        { href: "/estudio/categorias", label: "Categorías" },
        { href: "/estudio/mensajes", label: "Mensajes", badge: unread },
      ]}
    >
      {children}
    </PanelShell>
  );
}
