import { db } from "@/lib/db";
import { PanelTitle } from "@/components/panel/ui";
import { ConfirmButton } from "@/components/panel/ConfirmButton";
import { CategoryForm } from "@/components/panel/CategoryForm";
import { deleteCategory } from "../actions";

// Crear, editar, ordenar y eliminar categorías (cada fila es su propio formulario).
// También se pueden crear al vuelo desde Subir y desde la edición de una foto.
export default async function CategoriesPage() {
  const categories = await db.category.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { photos: true } } } });
  return (
    <>
      <PanelTitle eyebrow="Estudio" title="Categorías" />

      <div className="mb-14 border border-line p-6">
        <CategoryForm nextOrder={categories.length} />
      </div>

      {categories.length === 0 && <p className="text-sm text-mist">Todavía no hay categorías. Creá la primera arriba (por ejemplo «Retratos» o «Bodas»).</p>}

      <div className="divide-y divide-line border-y border-line">
        {categories.map((c) => (
          <div key={c.id} className="flex flex-col gap-4 py-5 md:flex-row md:items-end">
            <CategoryForm category={{ id: c.id, name: c.name, description: c.description ?? "", order: c.order, photos: c._count.photos }} />
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton variant="ghost" message={`¿Eliminar «${c.name}»? Sus fotos quedarán sin categoría.`}>Eliminar</ConfirmButton>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
