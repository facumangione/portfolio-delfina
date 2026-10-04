import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, signToken, signedUploadUrl, storageConfigProblem } from "@/lib/storage";
import { storageUsage } from "@/lib/quota";
import { formatBytes } from "@/lib/utils";
import { FORMATS, OPTIMIZED_TYPES, extensionOf, type UploadTicket } from "@/lib/uploads";

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

  // Una variable S3_* mal cargada hace que R2 rechace todo: mejor avisarlo claro
  const problem = storageConfigProblem();
  if (problem) return NextResponse.json({ error: `Falta configurar bien el almacenamiento en Vercel: ${problem}.` }, { status: 500 });

  const body = (await req.json().catch(() => null)) as { name?: string; size?: number; displayType?: string; thumbType?: string } | null;
  // El formato se reconoce por la extensión: los RAW no tienen un tipo estándar en el navegador
  const ext = extensionOf(String(body?.name ?? ""));
  const format = FORMATS[ext];
  const displayExt = OPTIMIZED_TYPES[body?.displayType ?? ""];
  const thumbExt = OPTIMIZED_TYPES[body?.thumbType ?? ""];
  if (!body || !format || !displayExt || !thumbExt) return NextResponse.json({ error: "Formato de imagen no admitido." }, { status: 415 });
  if (!(Number(body.size) > 0) || Number(body.size) > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "El archivo supera el máximo permitido." }, { status: 413 });
  // Límite gratuito de R2 (lib/quota.ts): mejor frenar la subida que generar un cobro
  const usage = await storageUsage();
  if (usage.used + Number(body.size) > usage.limit) {
    return NextResponse.json({ error: `No queda espacio gratis en R2 (${formatBytes(usage.used)} de ${formatBytes(usage.limit)}). Borrá fotos que no uses para liberar lugar.` }, { status: 507 });
  }

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
    mime: format.mime,
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
  // originalType: el Content-Type con el que el navegador tiene que subir el original
  return NextResponse.json({ token: signToken(ticket), originalType: format.mime, uploads: { original, display, thumb } });
}
