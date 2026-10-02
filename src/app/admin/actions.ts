"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/session";
import { isRole } from "@/lib/permissions";
import { saveSettings, SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";

export type AdminState = { ok?: boolean; error?: string } | undefined;

/** Cambia rol, estado y permiso de descarga de un usuario. */
export async function updateUser(form: FormData) {
  const me = await assertPermission("users.manage");
  const id = String(form.get("id"));
  const role = String(form.get("role"));
  if (!isRole(role)) throw new Error("Rol inválido");
  const active = form.get("active") === "on";
  // Protección: un admin no puede quitarse a sí mismo el acceso
  if (id === me.id && (role !== "ADMIN" || !active)) throw new Error("No podés quitarte tu propio acceso de administrador.");
  await db.user.update({ where: { id }, data: { role, active, canDownload: form.get("canDownload") === "on" } });
  revalidatePath("/admin", "layout");
}

export async function deleteUser(form: FormData) {
  const me = await assertPermission("users.manage");
  const id = String(form.get("id"));
  if (id === me.id) throw new Error("No podés eliminar tu propia cuenta.");
  await db.user.delete({ where: { id } });
  revalidatePath("/admin", "layout");
}

const newUser = z.object({
  name: z.string().trim().min(2, "Nombre muy corto."),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  password: z.string().min(8, "Mínimo 8 caracteres."),
  role: z.string().refine(isRole, "Rol inválido."),
});

export async function createUser(_prev: AdminState, form: FormData): Promise<AdminState> {
  await assertPermission("users.manage");
  const parsed = newUser.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { password, ...data } = parsed.data;
  if (await db.user.findUnique({ where: { email: data.email } })) return { error: "Ese email ya está registrado." };
  await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Guarda cualquier subconjunto de los textos del sitio (ver lib/settings.ts). */
export async function updateSettings(_prev: AdminState, form: FormData): Promise<AdminState> {
  await assertPermission("content.manage");
  const values: Partial<Record<SettingKey, string>> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    const v = form.get(key);
    if (typeof v === "string") values[key] = v.trim();
  }
  await saveSettings(values);
  revalidatePath("/", "layout");
  return { ok: true };
}
