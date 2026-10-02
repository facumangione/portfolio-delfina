"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export type AccountState = { ok?: boolean; error?: string } | undefined;

/** Cambia nombre, email y (opcionalmente) contraseña del usuario logueado. */
export async function updateAccount(_prev: AccountState, form: FormData): Promise<AccountState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Tu sesión expiró." };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Nombre muy corto."),
      email: z.string().trim().toLowerCase().email("Email inválido."),
      current: z.string().min(1, "Ingresá tu contraseña actual para confirmar."),
      password: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, current, password } = parsed.data;

  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "La contraseña actual no es correcta." };
  if (password && password.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (email !== user.email && (await db.user.findUnique({ where: { email } }))) return { error: "Ese email ya está en uso." };

  await db.user.update({
    where: { id: me.id },
    data: { name, email, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Instalación inicial: sólo funciona mientras NO existe ningún administrador.
 * Crea la primera cuenta de administrador e inicia sesión con ella.
 */
export async function installAdmin(_prev: AccountState, form: FormData): Promise<AccountState> {
  if (await db.user.count({ where: { role: "ADMIN" } })) redirect("/login");
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Nombre muy corto."),
      email: z.string().trim().toLowerCase().email("Email inválido."),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.upsert({ where: { email }, create: { name, email, passwordHash, role: "ADMIN" }, update: { name, passwordHash, role: "ADMIN", active: true } });
  await signIn("credentials", { email, password, redirectTo: "/admin/usuarios" });
}
