"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { saveCategory, type CategoryState } from "@/app/estudio/actions";
import { Button, Label, inputClass } from "./ui";

interface Category {
  id: string;
  name: string;
  description: string;
  order: number;
  photos: number;
}

/*
 * Formulario de una categoría en Estudio → Categorías: el de "Nueva categoría"
 * (sin `category`) o el de cada fila existente.
 *
 * Igual que en UserRowForm: se envía con onSubmit y no con action={...},
 * porque React 19 devuelve los campos a su valor inicial después de guardar y
 * la fila mostraba el nombre viejo.
 */
export function CategoryForm({ category, nextOrder = 0 }: { category?: Category; nextOrder?: number }) {
  const [state, setState] = useState<CategoryState>();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [order, setOrder] = useState(String(category?.order ?? nextOrder));

  const changed = !category || name !== category.name || description !== category.description || order !== String(category.order);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveCategory(undefined, data);
      setState(result);
      // La nueva ya aparece en la lista: dejamos el formulario listo para otra
      if (result?.ok && !category) {
        setName("");
        setDescription("");
        setOrder(String(Number(order) + 1));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid flex-1 items-end gap-6 md:grid-cols-[1fr_2fr_80px_auto]">
      {category && <input type="hidden" name="id" value={category.id} />}
      <label>
        <Label>{category ? `${category.photos} fotos` : "Nueva categoría"}</Label>
        <input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className={category ? `${inputClass} font-display text-xl!` : inputClass} />
      </label>
      <label><Label>Descripción</Label><input name="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" className={inputClass} /></label>
      <label><Label>Orden</Label><input name="order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} className={inputClass} /></label>
      <div className="flex items-center gap-4">
        <Button variant={category ? "ghost" : "primary"} type="submit" disabled={pending || !changed}>
          {pending ? "Guardando…" : category ? "Guardar" : "Crear"}
        </Button>
        <AnimatePresence>
          {state?.ok && !pending && !changed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="eyebrow text-emerald-300/90!">Guardado</motion.span>}
          {state?.ok && !pending && !category && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="eyebrow text-emerald-300/90!">Creada</motion.span>}
        </AnimatePresence>
      </div>
      {state?.error && <p className="text-sm text-red-300 md:col-span-4">{state.error}</p>}
    </form>
  );
}
