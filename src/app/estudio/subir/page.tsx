import { db } from "@/lib/db";
import { PanelTitle } from "@/components/panel/ui";
import { Uploader } from "@/components/panel/Uploader";

export default async function UploadPage() {
  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? 2048);
  const [categories, themes] = await Promise.all([
    db.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.photo.findMany({ where: { theme: { not: null } }, distinct: ["theme"], select: { theme: true } }),
  ]);
  return (
    <>
      <PanelTitle eyebrow="Estudio" title="Subir fotografías" />
      <Uploader maxMb={maxMb} categories={categories} themes={themes.map((t) => t.theme!)} />
    </>
  );
}
