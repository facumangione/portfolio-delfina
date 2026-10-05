"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/session";
import { removeFiles } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { uniqueSlug } from "@/lib/photos";
import { refreshPhotoIndex } from "@/lib/photo-index";

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
  await refreshPhotoIndex(d.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Nombre y descripción de una foto (los usa la pantalla de subida, por foto). */
export async function updatePhotoText(id: string, title: string, description: string): Promise<{ ok?: boolean; error?: string }> {
  await assertPermission("photos.manage");
  const name = title.trim().slice(0, 200);
  if (!name) return { error: "El nombre es obligatorio." };
  await db.photo.update({
    where: { id },
    data: { title: name, slug: await uniqueSlug(slugify(name), id), description: description.trim().slice(0, 2000) || null },
  });
  await refreshPhotoIndex(id);
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

export async function togglePublished(form: FormData) {
  await assertPermission("photos.manage");
  const id = String(form.get("id"));
  const photo = await db.photo.findUniqueOrThrow({ where: { id }, select: { published: true } });
  await db.photo.update({ where: { id }, data: { published: !photo.published } });
  revalidatePath("/", "layout");
}

// ---- Categorías ----

export type CategoryState = { ok?: boolean; error?: string; category?: { id: string; name: string } } | undefined;

/**
 * Crea o edita una categoría. Devuelve la categoría guardada, o un error en
 * castellano. Si se crea una con un nombre que ya existe, se usa la existente
 * en vez de fallar (el "slug" de la dirección tiene que ser único).
 */
export async function saveCategory(_prev: CategoryState, form: FormData): Promise<CategoryState> {
  await assertPermission("categories.manage");
  const id = form.get("id") ? String(form.get("id")) : null;
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Escribí un nombre." };
  const slug = slugify(name);
  const description = form.has("description") ? String(form.get("description") ?? "").trim() || null : undefined;
  const order = form.has("order") ? Number(form.get("order") ?? 0) || 0 : undefined;

  const same = await db.category.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (id) {
    if (same && same.id !== id) return { error: `Ya existe la categoría «${same.name}».` };
    const category = await db.category.update({ where: { id }, data: { name, slug, description, order }, select: { id: true, name: true } });
    // El nombre de la categoría forma parte del texto de búsqueda de sus fotos
    const photos = await db.photo.findMany({ where: { categoryId: id }, select: { id: true } });
    for (const p of photos) await refreshPhotoIndex(p.id);
    revalidatePath("/", "layout");
    return { ok: true, category };
  }
  if (same) return { ok: true, category: same };
  const category = await db.category.create({
    // Las nuevas van al final, salvo que se indique otro orden
    data: { name, slug, description, order: order ?? (await db.category.count()) },
    select: { id: true, name: true },
  });
  revalidatePath("/", "layout");
  return { ok: true, category };
}

export async function deleteCategory(form: FormData) {
  await assertPermission("categories.manage");
  // Las fotos de la categoría quedan "sin categoría" (onDelete: SetNull en el esquema)
  await db.category.delete({ where: { id: String(form.get("id")) } });
  revalidatePath("/", "layout");
}

/**
 * Archiva el original de las fotos: lo borra del bucket para liberar espacio
 * en R2 (los originales son casi todo el peso) y deja la foto en el sitio con
 * su versión web de 2400 px, que pasa a ser la que se descarga.
 * La fotógrafa conserva el original en su computadora o en su disco.
 */
async function archiveOriginals(ids: string[]) {
  const photos = await db.photo.findMany({ where: { id: { in: ids }, originalArchivedAt: null }, select: { id: true, originalPath: true } });
  for (const p of photos) {
    await removeFiles(p.originalPath);
    await db.photo.update({ where: { id: p.id }, data: { originalArchivedAt: new Date() } });
  }
}

export async function archiveOriginal(form: FormData) {
  await assertPermission("photos.manage");
  await archiveOriginals([String(form.get("id"))]);
  revalidatePath("/", "layout");
}

/**
 * Acciones en lote sobre las fotos marcadas en el listado del Estudio:
 * publicar, despublicar, asignar categoría, agregar etiqueta, destacar o eliminar.
 * Pensado para organizar cientos de fotos sin abrirlas una por una.
 */
export async function bulkPhotos(form: FormData) {
  await assertPermission("photos.manage");
  const ids = form.getAll("ids").map(String).filter(Boolean);
  const op = String(form.get("op") ?? "");
  if (!ids.length) return;
  const where = { id: { in: ids } };

  switch (op) {
    case "publish":
      await db.photo.updateMany({ where, data: { published: true } });
      break;
    case "unpublish":
      await db.photo.updateMany({ where, data: { published: false } });
      break;
    case "feature":
      await db.photo.updateMany({ where, data: { featured: true } });
      break;
    case "unfeature":
      await db.photo.updateMany({ where, data: { featured: false } });
      break;
    case "category":
      await db.photo.updateMany({ where, data: { categoryId: String(form.get("categoryId") ?? "") || null } });
      break;
    case "theme":
      await db.photo.updateMany({ where, data: { theme: String(form.get("theme") ?? "").trim() || null } });
      break;
    case "tag": {
      const name = String(form.get("tag") ?? "").trim().toLowerCase();
      if (!name) break;
      const tag = await db.tag.upsert({ where: { name }, create: { name, slug: slugify(name) }, update: {} });
      for (const id of ids) await db.photo.update({ where: { id }, data: { tags: { connect: { id: tag.id } } } });
      break;
    }
    case "archive":
      await archiveOriginals(ids);
      break;
    case "delete": {
      const photos = await db.photo.findMany({ where });
      await db.photo.deleteMany({ where });
      for (const p of photos) await removeFiles(p.originalPath, p.displayPath, p.thumbPath);
      await db.tag.deleteMany({ where: { photos: { none: {} } } });
      revalidatePath("/", "layout");
      return;
    }
  }
  for (const id of ids) await refreshPhotoIndex(id);
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
