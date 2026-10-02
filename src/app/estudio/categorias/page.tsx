import { db } from "@/lib/db";
import { Button, PanelTitle, inputClass, Label } from "@/components/panel/ui";
import { ConfirmButton } from "@/components/panel/ConfirmButton";
import { deleteCategory, saveCategory } from "../actions";

// Crear, editar, ordenar y eliminar categorías (cada fila es su propio formulario).
export default async function CategoriesPage() {
  const categories = await db.category.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { photos: true } } } });
  return (
    <>
      <PanelTitle eyebrow="Estudio" title="Categorías" />

      <form action={saveCategory} className="mb-14 grid items-end gap-6 border border-line p-6 md:grid-cols-[1fr_2fr_80px_auto]">
        <label><Label>Nueva categoría</Label><input name="name" required placeholder="Nombre" className={inputClass} /></label>
        <label><Label>Descripción</Label><input name="description" placeholder="Opcional" className={inputClass} /></label>
        <label><Label>Orden</Label><input name="order" type="number" defaultValue={categories.length} className={inputClass} /></label>
        <Button type="submit">Crear</Button>
      </form>

      <div className="divide-y divide-line border-y border-line">
        {categories.map((c) => (
          <div key={c.id} className="flex flex-col gap-4 py-5 md:flex-row md:items-end">
            <form action={saveCategory} className="grid flex-1 items-end gap-6 md:grid-cols-[1fr_2fr_80px_auto]">
              <input type="hidden" name="id" value={c.id} />
              <label><Label>{c._count.photos} fotos</Label><input name="name" defaultValue={c.name} className={`${inputClass} font-display text-xl!`} /></label>
              <label><Label>Descripción</Label><input name="description" defaultValue={c.description ?? ""} className={inputClass} /></label>
              <label><Label>Orden</Label><input name="order" type="number" defaultValue={c.order} className={inputClass} /></label>
              <Button variant="ghost" type="submit">Guardar</Button>
            </form>
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
