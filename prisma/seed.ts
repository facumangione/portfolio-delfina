// Carga datos de ejemplo: usuarios de cada rol, categorías, etiquetas y fotos.
// Ejecutar con: npm run db:seed   (borra y vuelve a crear todo)

import fsp from "node:fs/promises";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { renderSample, type SceneName } from "./sample-images";
import { STORAGE_DIR, STORAGE_MODE, writeFile } from "../src/lib/storage";
import { processImage } from "./process-image";
import { slugify } from "../src/lib/utils";
import { refreshPhotoIndex } from "../src/lib/photo-index";

const db = new PrismaClient();

const CATEGORIES = [
  { name: "Paisaje", description: "Territorio, montaña y horizonte." },
  { name: "Retrato", description: "Personas, luz y gesto." },
  { name: "Arquitectura", description: "Forma, línea y sombra." },
  { name: "Urbana", description: "La ciudad de noche." },
  { name: "Naturaleza", description: "Lo pequeño y lo vivo." },
];

type Sample = {
  title: string; scene: SceneName; palette: "dusk" | "dawn" | "mono" | "forest" | "ember" | "sea";
  category: string; theme: string; tags: string[]; date: string; w: number; h: number;
  location?: string; featured?: boolean; downloadable?: boolean;
};

const SAMPLES: Sample[] = [
  { title: "Cordillera al atardecer", scene: "landscape", palette: "dusk", category: "Paisaje", theme: "Hora dorada", tags: ["montaña", "atardecer", "niebla"], date: "2026-03-14", w: 6000, h: 4000, location: "Potrerillos", featured: true },
  { title: "Mar quieto", scene: "sea", palette: "dawn", category: "Paisaje", theme: "Minimalismo", tags: ["mar", "horizonte", "calma"], date: "2025-12-02", w: 4800, h: 3200, location: "Mar de las Pampas", featured: true },
  { title: "Perfil en penumbra", scene: "portrait", palette: "mono", category: "Retrato", theme: "Blanco y negro", tags: ["retrato", "claroscuro"], date: "2026-05-20", w: 3200, h: 4800, featured: true },
  { title: "Bloques", scene: "architecture", palette: "forest", category: "Arquitectura", theme: "Geometría", tags: ["edificios", "líneas"], date: "2025-09-11", w: 3600, h: 4500, location: "Buenos Aires" },
  { title: "Luces de avenida", scene: "city", palette: "ember", category: "Urbana", theme: "Nocturna", tags: ["ciudad", "bokeh", "noche"], date: "2026-01-28", w: 4500, h: 3000, location: "Córdoba" },
  { title: "Juncos", scene: "nature", palette: "sea", category: "Naturaleza", theme: "Minimalismo", tags: ["plantas", "agua", "calma"], date: "2026-02-09", w: 3000, h: 4500 },
  { title: "Valle en niebla", scene: "landscape", palette: "dawn", category: "Paisaje", theme: "Niebla", tags: ["montaña", "niebla", "amanecer"], date: "2025-07-03", w: 5400, h: 3000, location: "Uspallata", featured: true },
  { title: "Retrato con luz de ventana", scene: "portrait", palette: "ember", category: "Retrato", theme: "Luz natural", tags: ["retrato", "ventana", "cálido"], date: "2026-06-17", w: 3200, h: 4000 },
  { title: "Marea baja", scene: "sea", palette: "sea", category: "Paisaje", theme: "Azul", tags: ["mar", "horizonte"], date: "2025-11-21", w: 4000, h: 4000 },
  { title: "Fachadas", scene: "architecture", palette: "mono", category: "Arquitectura", theme: "Blanco y negro", tags: ["edificios", "sombras", "líneas"], date: "2026-04-02", w: 4500, h: 3000 },
  { title: "Bokeh dorado", scene: "city", palette: "dusk", category: "Urbana", theme: "Nocturna", tags: ["bokeh", "noche"], date: "2025-10-14", w: 3000, h: 4200, downloadable: false },
  { title: "Pastizal", scene: "nature", palette: "forest", category: "Naturaleza", theme: "Luz natural", tags: ["plantas", "verde"], date: "2026-07-08", w: 4500, h: 3000, location: "Tupungato" },
  { title: "Brasas en el cielo", scene: "landscape", palette: "ember", category: "Paisaje", theme: "Hora dorada", tags: ["atardecer", "montaña", "cálido"], date: "2026-08-22", w: 7680, h: 4320, location: "Aconcagua", featured: true },
  { title: "Silencio azul", scene: "sea", palette: "mono", category: "Paisaje", theme: "Blanco y negro", tags: ["mar", "calma", "horizonte"], date: "2025-05-30", w: 4800, h: 2700 },
  { title: "Retrato en verde", scene: "portrait", palette: "forest", category: "Retrato", theme: "Luz natural", tags: ["retrato", "verde"], date: "2025-08-19", w: 3000, h: 3750 },
  { title: "Torre", scene: "architecture", palette: "dusk", category: "Arquitectura", theme: "Geometría", tags: ["edificios", "atardecer"], date: "2026-09-05", w: 3000, h: 4500 },
  { title: "Noche de lluvia", scene: "city", palette: "sea", category: "Urbana", theme: "Nocturna", tags: ["ciudad", "lluvia", "bokeh"], date: "2026-03-30", w: 4500, h: 3000 },
  { title: "Hierba al alba", scene: "nature", palette: "dawn", category: "Naturaleza", theme: "Niebla", tags: ["plantas", "amanecer", "niebla"], date: "2025-06-12", w: 3600, h: 3600 },
];

async function main() {
  console.log("→ Limpiando base y almacenamiento…");
  await db.favorite.deleteMany();
  await db.photo.deleteMany();
  await db.tag.deleteMany();
  await db.category.deleteMany();
  await db.contactMessage.deleteMany();
  await db.setting.deleteMany();
  await db.user.deleteMany();
  if (STORAGE_MODE === "local") await fsp.rm(STORAGE_DIR, { recursive: true, force: true });

  console.log("→ Usuarios");
  const hash = (p: string) => bcrypt.hash(p, 10);
  const admin = await db.user.create({ data: { name: "Administración", email: "admin@portfolio.com", passwordHash: await hash("admin1234"), role: "ADMIN" } });
  const photographer = await db.user.create({ data: { name: "Delfina", email: "delfina@portfolio.com", passwordHash: await hash("foto1234"), role: "PHOTOGRAPHER" } });
  const user = await db.user.create({ data: { name: "Visitante", email: "usuario@portfolio.com", passwordHash: await hash("usuario1234"), role: "USER" } });
  void admin;

  console.log("→ Categorías");
  const categories: Record<string, string> = {};
  for (const [order, c] of CATEGORIES.entries()) {
    const created = await db.category.create({ data: { ...c, slug: slugify(c.name), order } });
    categories[c.name] = created.id;
  }

  console.log(`→ Generando ${SAMPLES.length} fotografías de ejemplo (originales en alta resolución)…`);
  const created: string[] = [];
  for (const [i, s] of SAMPLES.entries()) {
    const photoId = `sample${String(i + 1).padStart(2, "0")}`;
    const original = await renderSample(s.scene, s.palette, s.w, s.h, i * 97 + 13);
    const { display, thumb, version, ...processed } = await processImage(original);
    const keys = { original: `originals/${photoId}.jpg`, display: `display/${photoId}-${version}.webp`, thumb: `thumbs/${photoId}-${version}.webp` };
    await writeFile(keys.original, original, "image/jpeg");
    await writeFile(keys.display, display, "image/webp");
    await writeFile(keys.thumb, thumb, "image/webp");
    await db.photo.create({
      data: {
        id: photoId,
        slug: slugify(s.title),
        title: s.title,
        description: `${s.theme}. ${s.location ? `Tomada en ${s.location}.` : ""}`.trim(),
        theme: s.theme,
        location: s.location,
        camera: i % 2 ? "Fujifilm GFX 100S · 63mm" : "Sony A7R V · 35mm",
        published: true,
        featured: Boolean(s.featured),
        downloadable: s.downloadable ?? true,
        originalPath: keys.original,
        originalName: `${slugify(s.title)}.jpg`,
        originalMime: "image/jpeg",
        originalSize: original.length,
        displayPath: keys.display,
        displaySize: display.length,
        thumbPath: keys.thumb,
        thumbSize: thumb.length,
        ...processed,
        takenAt: new Date(s.date),
        views: Math.floor(Math.random() * 400),
        downloads: Math.floor(Math.random() * 40),
        categoryId: categories[s.category],
        uploadedById: photographer.id,
        tags: {
          connectOrCreate: s.tags.map((t) => ({ where: { name: t }, create: { name: t, slug: slugify(t) } })),
        },
      },
    });
    await refreshPhotoIndex(photoId);
    created.push(photoId);
    console.log(`   ${i + 1}/${SAMPLES.length} ${s.title} (${s.w}×${s.h})`);
  }

  await db.favorite.createMany({ data: created.slice(0, 4).map((photoId) => ({ userId: user.id, photoId })) });
  for (const id of created.slice(0, 4)) await refreshPhotoIndex(id);
  await db.setting.create({ data: { key: "heroPhotoId", value: created[12] } });
  await db.contactMessage.create({
    data: { name: "Lucía Ferreyra", email: "lucia@example.com", message: "Hola Delfina, me interesa una impresión grande de «Mar quieto». ¿Hacés envíos?" },
  });

  console.log("\n✓ Listo. Usuarios de prueba:");
  console.log("  admin@portfolio.com    / admin1234    (Administrador)");
  console.log("  delfina@portfolio.com  / foto1234     (Fotógrafa)");
  console.log("  usuario@portfolio.com  / usuario1234  (Usuario)");
}

main().finally(() => db.$disconnect());
