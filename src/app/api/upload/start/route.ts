import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, signToken, signedUploadUrl } from "@/lib/storage";
import { ORIGINAL_TYPES, OPTIMIZED_TYPES, type UploadTicket } from "@/lib/uploads";

/*
 * Subida de fotografías, paso 1 de 2.
 *
 * El navegador ya generó las versiones optimizadas (lib/client-image.ts) y
 * pide permiso para subir tres archivos: original, versión de pantalla y
 * miniatura. Respondemos con una URL firmada para cada uno: el navegador los
 * sube DIRECTO al almacenamiento (R2), sin pasar por este servidor. Así no
 * importa que el original pese cientos de MB.
 *
 * También devolvemos un "token" firmado con lo que autorizamos; el paso 2
 * (/api/upload/complete) sólo acepta esos mismos archivos.
 */

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "photos.manage")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { name?: string; type?: string; size?: number; displayType?: string; thumbType?: string } | null;
  const ext = ORIGINAL_TYPES[body?.type ?? ""];
  const displayExt = OPTIMIZED_TYPES[body?.displayType ?? ""];
  const thumbExt = OPTIMIZED_TYPES[body?.thumbType ?? ""];
  if (!body || !ext || !displayExt || !thumbExt) return NextResponse.json({ error: "Formato no admitido (JPG, PNG, WebP o AVIF)." }, { status: 415 });
  if (!(Number(body.size) > 0) || Number(body.size) > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "El archivo supera el máximo permitido." }, { status: 413 });

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  // La versión en el nombre permite cachear para siempre: si cambia la imagen, cambia la URL.
  const version = crypto.randomBytes(4).toString("hex");
  // El original lleva además un sufijo secreto: el id se ve en las URLs públicas
  // de las miniaturas, y así no se puede adivinar la dirección del original.
  const secret = crypto.randomBytes(12).toString("hex");
  const ticket: UploadTicket = {
    id,
    uid: user.id,
    name: String(body.name ?? `foto.${ext}`).slice(0, 200),
    mime: body.type!,
    keys: {
      original: `originals/${id}-${secret}.${ext}`,
      display: `display/${id}-${version}.${displayExt}`,
      thumb: `thumbs/${id}-${version}.${thumbExt}`,
    },
    exp: Date.now() + 6 * 3600 * 1000,
  };

  const [original, display, thumb] = await Promise.all([
    signedUploadUrl(ticket.keys.original, ticket.mime, 6 * 3600),
    signedUploadUrl(ticket.keys.display, body.displayType!),
    signedUploadUrl(ticket.keys.thumb, body.thumbType!),
  ]);
  return NextResponse.json({ token: signToken(ticket), uploads: { original, display, thumb } });
}
