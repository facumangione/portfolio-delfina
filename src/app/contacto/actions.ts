"use server";

import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2, "Contanos tu nombre."),
  email: z.string().trim().email("Revisá el email."),
  message: z.string().trim().min(10, "El mensaje es muy corto.").max(5000),
});

export type ContactState = { ok?: boolean; error?: string } | undefined;

// Guarda el mensaje; la fotógrafa lo lee en Estudio → Mensajes.
// (Para recibirlo también por email, acá se conectaría un servicio como Resend.)
export async function sendContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.contactMessage.create({ data: parsed.data });
  return { ok: true };
}
