import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { photoInclude, toDTO } from "@/lib/photos";
import { refreshPhotoIndex } from "@/lib/photo-index";
import { PhotoView } from "@/components/photo/PhotoView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const photo = await db.photo.findUnique({ where: { slug }, select: { title: true, description: true } });
  return { title: photo?.title ?? "Fotografía", description: photo?.description ?? undefined };
}

// Vista dedicada de una fotografía. Se cuenta una visita en cada apertura.
export default async function PhotoPage({ params }: Props) {
  const { slug } = await params;
  const found = await db.photo.findFirst({ where: { slug, published: true }, include: photoInclude });
  if (!found) notFound();
  await db.photo.update({ where: { id: found.id }, data: { views: { increment: 1 } } });
  await refreshPhotoIndex(found.id);
  const photo = toDTO(found);

  // Anterior / siguiente por fecha y relacionadas de la misma categoría
  const all = await db.photo.findMany({
    where: { published: true },
    select: { slug: true, title: true },
    orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
  });
  const i = all.findIndex((p) => p.slug === slug);
  const prev = all[(i - 1 + all.length) % all.length];
  const next = all[(i + 1) % all.length];

  const related = (
    await db.photo.findMany({
      where: { published: true, categoryId: found.categoryId, id: { not: found.id } },
      include: photoInclude,
      take: 4,
      orderBy: { takenAt: "desc" },
    })
  ).map(toDTO);

  return <PhotoView photo={photo} prev={prev} next={next} related={related} />;
}
