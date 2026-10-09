"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/session";
import { isRole } from "@/lib/permissions";
import { saveSettings, SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";
import { clampPercent, parseFocus } from "@/lib/focus";

export type AdminState = { ok?: boolean; error?: string } | undefined;

/**
 * Cambia rol, estado y permiso de descarga de un usuario.
 * Devuelve el resultado (en vez de lanzar un error) para que la fila de la
 * lista muestre "Guardado" o el motivo por el que no se pudo.
 */
export async function updateUser(_prev: AdminState, form: FormData): Promise<AdminState> {
  const me = await assertPermission("users.manage");
  const id = String(form.get("id"));
  const role = String(form.get("role"));
  if (!isRole(role)) return { error: "Rol inválido." };
  const active = form.get("active") === "on";
  // Protección: un admin no puede quitarse a sí mismo el acceso
  if (id === me.id && (role !== "ADMIN" || !active)) return { error: "No podés quitarte tu propio acceso de administrador." };
  await db.user.update({ where: { id }, data: { role, active, canDownload: form.get("canDownload") === "on" } });
  revalidatePath("/", "layout");
  return { ok: true };
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
  // Punto de enfoque de la foto de portada (se guarda en la foto, no en los ajustes)
  const focusPhotoId = form.get("focusPhotoId");
  const focus = form.get("focus");
  if (typeof focusPhotoId === "string" && focusPhotoId && typeof focus === "string") {
    const { x, y } = parseFocus(focus);
    await db.photo.updateMany({ where: { id: focusPhotoId }, data: { focusX: x, focusY: y } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Guarda el punto de enfoque que el navegador calculó para fotos que todavía
 * no lo tenían (las subidas antes de que existiera la detección automática).
 * Sólo completa las vacías: nunca pisa un enfoque ya guardado o corregido a mano.
 */
export async function saveDetectedFocus(items: { id: string; x: number; y: number }[]) {
  await assertPermission("content.manage");
  const valid = items.filter((it) => typeof it.id === "string" && Number.isFinite(it.x) && Number.isFinite(it.y)).slice(0, 200);
  for (const it of valid) {
    await db.photo.updateMany({ where: { id: it.id, focusX: null }, data: { focusX: clampPercent(it.x), focusY: clampPercent(it.y) } });
  }
  if (valid.length) revalidatePath("/", "layout");
}
