"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { bulkPhotos } from "@/app/estudio/actions";
import { Button, selectClass, inputClass } from "./ui";
import { CategorySelect } from "./CategorySelect";
import { EASE_CINE } from "@/components/motion/easing";

/*
 * Barra de acciones en lote del listado de fotos. Los checkboxes de cada fila
 * pertenecen al formulario "bulk" (atributo form="bulk"), así que al enviar
 * llegan todos los ids marcados a la acción bulkPhotos del servidor.
 */
const OPS = {
  publish: "Publicar",
  unpublish: "Pasar a borrador",
  category: "Asignar categoría",
  theme: "Asignar tema",
  tag: "Agregar etiqueta",
  feature: "Destacar",
  unfeature: "Quitar de destacadas",
  delete: "Eliminar",
} as const;
type Op = keyof typeof OPS;

export function BulkBar({ categories }: { categories: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState(0);
  const [op, setOp] = useState<Op>("publish");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    const count = () => setSelected(document.querySelectorAll<HTMLInputElement>('input[form="bulk"][name="ids"]:checked').length);
    document.addEventListener("change", count);
    count();
    return () => document.removeEventListener("change", count);
  }, []);

  const toggleAll = (checked: boolean) => {
    document.querySelectorAll<HTMLInputElement>('input[form="bulk"][name="ids"]').forEach((cb) => (cb.checked = checked));
    setSelected(checked ? document.querySelectorAll('input[form="bulk"][name="ids"]').length : 0);
  };

  return (
    <form
      id="bulk"
      action={async (fd) => {
        await bulkPhotos(fd);
        toggleAll(false);
      }}
      onSubmit={(e) => {
        if (op === "delete" && !confirm(`¿Eliminar ${selected} fotografías con sus originales? No se puede deshacer.`)) e.preventDefault();
      }}
      className="sticky top-0 z-20 -mx-2 mb-6 flex flex-wrap items-end gap-5 bg-ink/90 px-2 py-4 backdrop-blur-xl"
    >
      <label className="flex items-center gap-2 pb-2 text-sm text-mist">
        <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} className="h-4 w-4 accent-[#d8c3a5]" />
        Todas en esta página
      </label>
      <AnimatePresence>
        {selected > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.4, ease: EASE_CINE }}
            className="flex flex-wrap items-end gap-5"
          >
            <span className="eyebrow pb-2.5 text-bone!">{selected} seleccionadas</span>
            <select name="op" value={op} onChange={(e) => setOp(e.target.value as Op)} className={`${selectClass} w-48!`}>
              {(Object.keys(OPS) as Op[]).map((k) => <option key={k} value={k}>{OPS[k]}</option>)}
            </select>
            {op === "category" && (
              <div className="w-56">
                <CategorySelect name="categoryId" value={categoryId} onChange={setCategoryId} categories={categories} />
              </div>
            )}
            {op === "theme" && <input name="theme" placeholder="Tema" className={`${inputClass} w-44!`} />}
            {op === "tag" && <input name="tag" placeholder="Etiqueta" required className={`${inputClass} w-44!`} />}
            <Button type="submit" variant={op === "delete" ? "danger" : "primary"}>Aplicar</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
