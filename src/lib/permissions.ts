// Roles y permisos de la plataforma, definidos en un único lugar.
// Las páginas y las acciones del servidor consultan `can(rol, permiso)`.

export const ROLES = ["USER", "PHOTOGRAPHER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  USER: "Usuario",
  PHOTOGRAPHER: "Fotógrafa",
  ADMIN: "Administrador",
};

export const PERMISSIONS = {
  "photos.view": "Explorar, buscar, filtrar y ordenar fotografías",
  "photos.download": "Descargar fotografías permitidas",
  "favorites.manage": "Marcar y gestionar favoritos",
  "contact.send": "Contactar a la fotógrafa",
  "photos.manage": "Subir, editar, organizar y eliminar fotografías",
  "categories.manage": "Crear y editar categorías",
  "messages.read": "Leer mensajes de contacto",
  "profile.manage": "Editar su perfil público, redes y medios de contacto",
  "content.manage": "Editar textos del sitio y la foto de portada",
  "users.manage": "Gestionar usuarios, roles y permisos",
} as const;
export type Permission = keyof typeof PERMISSIONS;

const BASE: Permission[] = ["photos.view", "photos.download", "favorites.manage", "contact.send"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  USER: BASE,
  PHOTOGRAPHER: [...BASE, "photos.manage", "categories.manage", "messages.read", "profile.manage"],
  ADMIN: Object.keys(PERMISSIONS) as Permission[],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: string | undefined | null, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
