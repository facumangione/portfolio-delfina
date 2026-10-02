import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Permission, type Role } from "./permissions";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  canDownload: boolean;
}

/** Usuario logueado o null. Se usa en Server Components, acciones y rutas API. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return { id: u.id, name: u.name ?? "", email: u.email ?? "", role: u.role, canDownload: u.canDownload };
}

/** Exige un permiso; si no lo tiene, redirige al login o al inicio. */
export async function requirePermission(permission: Permission, from = "/"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(from)}`);
  if (!can(user.role, permission)) redirect("/");
  return user;
}

/** Variante para acciones del servidor: lanza un error en vez de redirigir. */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, permission)) throw new Error("No autorizado");
  return user;
}
