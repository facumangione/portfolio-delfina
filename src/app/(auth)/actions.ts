"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";

// Acciones del servidor (Server Actions) de autenticación.
// Se llaman directamente desde los formularios, sin escribir una API a mano.

export type FormState = { error?: string } | undefined;

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: String(form.get("email") ?? "").toLowerCase(),
      password: String(form.get("password") ?? ""),
      redirectTo: safeNext(form.get("next")),
    });
  } catch (err) {
    // signIn lanza una "redirección" cuando sale bien: hay que dejarla pasar
    if (err instanceof AuthError) return { error: "Email o contraseña incorrectos." };
    throw err;
  }
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre."),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "Ya existe una cuenta con ese email." };

  // Las cuentas nuevas siempre son "USER"; el administrador puede cambiar el rol.
  await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10), role: "USER" } });
  try {
    await signIn("credentials", { email, password, redirectTo: safeNext(form.get("next")) });
  } catch (err) {
    if (err instanceof AuthError) return { error: "La cuenta se creó, pero no se pudo iniciar sesión." };
    throw err;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
