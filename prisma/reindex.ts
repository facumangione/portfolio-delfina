// Recalcula los campos de búsqueda/orden de TODAS las fotos (orientación,
// popularidad, favoritos y texto de búsqueda). Correrlo después de actualizar
// desde una versión anterior del proyecto:   npm run reindexar

import { PrismaClient } from "@prisma/client";
import { refreshPhotoIndex } from "../src/lib/photo-index";

async function main() {
  const db = new PrismaClient();
  const photos = await db.photo.findMany({ select: { id: true } });
  for (const p of photos) await refreshPhotoIndex(p.id);
  await db.$disconnect();
  console.log(`✓ ${photos.length} fotos reindexadas.`);
}
main();
