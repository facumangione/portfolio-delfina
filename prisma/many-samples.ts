// HERRAMIENTA DE PRUEBA: multiplica las fotos de ejemplo hasta llegar a N
// (por defecto 600) para ver cómo se comporta el sitio con un archivo grande.
// Copia los archivos de las fotos de ejemplo (en la carpeta local o en el bucket).
//   npm run ejemplos:muchas -- 1000
// Después se pueden borrar con: npm run ejemplos:borrar

import { PrismaClient } from "@prisma/client";
import { readFile, writeFile } from "../src/lib/storage";
import { refreshPhotoIndex } from "../src/lib/photo-index";

async function main() {
  const target = Number(process.argv[2] ?? 600);
  const db = new PrismaClient();
  const base = await db.photo.findMany({ where: { id: { startsWith: "sample" } }, include: { tags: true } });
  if (!base.length) throw new Error("Primero corré npm run db:seed");
  let count = await db.photo.count({ where: { id: { startsWith: "sample" } } });

  for (let n = 0; count < target; n++, count++) {
    const src = base[n % base.length];
    const id = `samplex${String(count).padStart(5, "0")}`;
    const copy = async (rel: string, ext: string) => {
      const dest = rel.replace(src.id, id).replace(/\.[^.]+$/, ext);
      const file = await readFile(rel);
      if (!file) throw new Error(`Falta el archivo ${rel}`);
      await writeFile(dest, Buffer.from(await new Response(file.body).arrayBuffer()), ext === ".jpg" ? "image/jpeg" : "image/webp");
      return dest;
    };
    const date = new Date(src.takenAt ?? Date.now());
    date.setUTCDate(date.getUTCDate() - n * 3); // fechas distintas para que haya varios años
    const { id: _id, tags, slug, createdAt: _c, updatedAt: _u, ...rest } = src;
    void _id; void _c; void _u;
    await db.photo.create({
      data: {
        ...rest,
        id,
        slug: `${slug}-${count}`,
        title: `${src.title} ${Math.floor(n / base.length) + 2}`,
        takenAt: date,
        featured: false,
        originalPath: await copy(src.originalPath, ".jpg"),
        displayPath: await copy(src.displayPath, ".webp"),
        thumbPath: await copy(src.thumbPath, ".webp"),
        views: Math.floor(Math.random() * 500),
        downloads: Math.floor(Math.random() * 50),
        tags: { connect: tags.map((t) => ({ id: t.id })) },
      },
    });
    await refreshPhotoIndex(id);
    if (count % 100 === 0) console.log(`  ${count}…`);
  }
  await db.$disconnect();
  console.log(`✓ Ahora hay ${count} fotos de ejemplo.`);
}
main();
