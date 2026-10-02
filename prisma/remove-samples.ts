// Borra las fotos de ejemplo (y sus archivos), dejando intactas las fotos reales,
// los usuarios y las categorías.   npm run ejemplos:borrar

import { PrismaClient } from "@prisma/client";
import { removeFiles } from "../src/lib/storage";

async function main() {
  const db = new PrismaClient();
  const samples = await db.photo.findMany({ where: { id: { startsWith: "sample" } } });
  await db.photo.deleteMany({ where: { id: { startsWith: "sample" } } });
  for (const p of samples) await removeFiles(p.originalPath, p.displayPath, p.thumbPath);
  await db.tag.deleteMany({ where: { photos: { none: {} } } });
  const hero = await db.setting.findUnique({ where: { key: "heroPhotoId" } });
  if (hero?.value.startsWith("sample")) await db.setting.delete({ where: { key: "heroPhotoId" } });
  await db.$disconnect();
  console.log(`✓ ${samples.length} fotos de ejemplo eliminadas.`);
}
main();
