"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/session";
import { PROFILE_KEYS, saveSettings, type Settings } from "@/lib/settings";

export type ProfileState = { ok?: boolean; error?: string } | undefined;

/**
 * Guarda el perfil público (nombre, biografía, redes y medios de contacto).
 * Lo pueden usar la fotógrafa y el administrador ("profile.manage").
 * Sólo acepta las claves de PROFILE_KEYS: aunque alguien envíe otras
 * (por ejemplo la foto de portada), se ignoran.
 */
export async function updateProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  await assertPermission("profile.manage");
  const values: Partial<Settings> = {};
  for (const key of PROFILE_KEYS) {
    const v = form.get(key);
    if (typeof v === "string") values[key] = v.trim().slice(0, 2000);
  }
  if (!values.photographerName) return { error: "El nombre público no puede quedar vacío." };
  const email = values.contactEmail;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Revisá el email de contacto." };
  await saveSettings(values);
  revalidatePath("/", "layout");
  return { ok: true };
}
