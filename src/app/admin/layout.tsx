import { requirePermission } from "@/lib/session";
import { PanelShell } from "@/components/panel/PanelShell";

export const dynamic = "force-dynamic";

// /admin exige "users.manage", que sólo tiene el rol ADMIN.
// Fotos y categorías se gestionan con las mismas pantallas del Estudio.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("users.manage", "/admin");
  return (
    <PanelShell
      title="Administración"
      links={[
        { href: "/admin", label: "Resumen" },
        { href: "/admin/usuarios", label: "Usuarios" },
        { href: "/admin/fotografa", label: "Fotógrafa" },
        { href: "/admin/contenido", label: "Contenido" },
        { href: "/admin/permisos", label: "Permisos" },
        { href: "/estudio/fotos", label: "Fotografías ↗" },
        { href: "/estudio/categorias", label: "Categorías ↗" },
      ]}
    >
      {children}
    </PanelShell>
  );
}
