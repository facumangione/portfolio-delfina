"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/session";
import { absolute, removeFiles } from "@/lib/storage";
import { processImage } from "@/lib/images";
import { slugify } from "@/lib/utils";
import { uniqueSlug } from "@/lib/photos";

// Acciones del panel de la fotógrafa. Cada una vuelve a verificar el permiso
// en el servidor: nunca confiamos sólo en que el botón esté oculto.

const photoSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, "El título es obligatorio."),
  description: z.string().trim().optional(),
  takenAt: z.string().optional(),
  categoryId: z.string().optional(),
  theme: z.string().trim().optional(),
  location: z.string().trim().optional(),
  camera: z.string().trim().optional(),
  tags: z.string().optional(),
});

export type PhotoFormState = { ok?: boolean; error?: string } | undefined;

export async function updatePhoto(_prev: PhotoFormState, form: FormData): Promise<PhotoFormState> {
  await assertPermission("photos.manage");
  const parsed = photoSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const tagNames = [...new Set((d.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
  const slug = await uniqueSlug(slugify(d.title), d.id);

  await db.photo.update({
    where: { id: d.id },
    data: {
      title: d.title,
      slug,
      description: d.description || null,
      takenAt: d.takenAt ? new Date(d.takenAt) : null,
      categoryId: d.categoryId || null,
      theme: d.theme || null,
      location: d.location || null,
      camera: d.camera || null,
      published: form.get("published") === "on",
      featured: form.get("featured") === "on",
      downloadable: form.get("downloadable") === "on",
      // Reemplazamos el conjunto de etiquetas, creando las que no existan
      tags: {
        set: [],
        connectOrCreate: tagNames.map((name) => ({ where: { name }, create: { name, slug: slugify(name) } })),
      },
    },
  });
  // Borramos etiquetas que quedaron sin fotos
  await db.tag.deleteMany({ where: { photos: { none: {} } } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePhoto(form: FormData) {
  await assertPermission("photos.manage");
  const id = String(form.get("id"));
  const photo = await db.photo.delete({ where: { id } });
  await removeFiles(photo.originalPath, photo.displayPath, photo.thumbPath);
  revalidatePath("/", "layout");
  redirect("/estudio/fotos");
}

/** Regenera las versiones optimizadas a partir del original (p. ej. si cambia la calidad). */
export async function reprocessPhoto(form: FormData) {
  await assertPermission("photos.manage");
  const id = String(form.get("id"));
  const photo = await db.photo.findUniqueOrThrow({ where: { id } });
  const processed = await processImage(absolute(photo.originalPath), photo.id);
  await db.photo.update({ where: { id }, data: processed });
  await removeFiles(photo.displayPath, photo.thumbPath);
  revalidatePath("/", "layout");
}

export async function togglePublished(form: FormData) {
  await assertPermission("photos.manage");
  const id = String(form.get("id"));
  const photo = await db.photo.findUniqueOrThrow({ where: { id }, select: { published: true } });
  await db.photo.update({ where: { id }, data: { published: !photo.published } });
  revalidatePath("/", "layout");
}

// ---- Categorías ----

export async function saveCategory(form: FormData) {
  await assertPermission("categories.manage");
  const id = form.get("id") ? String(form.get("id")) : null;
  const name = String(form.get("name") ?? "").trim();
  if (!name) return;
  const data = {
    name,
    slug: slugify(name),
    description: String(form.get("description") ?? "").trim() || null,
    order: Number(form.get("order") ?? 0) || 0,
  };
  if (id) await db.category.update({ where: { id }, data });
  else await db.category.create({ data });
  revalidatePath("/", "layout");
}

export async function deleteCategory(form: FormData) {
  await assertPermission("categories.manage");
  // Las fotos de la categoría quedan "sin categoría" (onDelete: SetNull en el esquema)
  await db.category.delete({ where: { id: String(form.get("id")) } });
  revalidatePath("/", "layout");
}

/** Asigna una categoría a varias fotos a la vez desde el listado. */
export async function assignCategory(form: FormData) {
  await assertPermission("photos.manage");
  const ids = form.getAll("ids").map(String);
  const categoryId = String(form.get("categoryId") ?? "") || null;
  if (ids.length) await db.photo.updateMany({ where: { id: { in: ids } }, data: { categoryId } });
  revalidatePath("/", "layout");
}

// ---- Mensajes ----

export async function toggleMessageRead(form: FormData) {
  await assertPermission("messages.read");
  const id = String(form.get("id"));
  const msg = await db.contactMessage.findUniqueOrThrow({ where: { id } });
  await db.contactMessage.update({ where: { id }, data: { read: !msg.read } });
  revalidatePath("/estudio", "layout");
}

export async function deleteMessage(form: FormData) {
  await assertPermission("messages.read");
  await db.contactMessage.delete({ where: { id: String(form.get("id")) } });
  revalidatePath("/estudio", "layout");
}
