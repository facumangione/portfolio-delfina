"use client";

import { useState, useTransition } from "react";
import { saveCategory } from "@/app/estudio/actions";
import { inputClass, selectClass } from "./ui";

const NEW = "__nueva__";

/*
 * Selector de categoría con la opción "+ Nueva categoría…": permite crearla
 * ahí mismo (al subir fotos o al editar una) sin ir a Estudio → Categorías.
 * La nueva queda elegida y se agrega a la lista.
 */
export function CategorySelect({
  name,
  value,
  onChange,
  categories: initial,
}: {
  name?: string;
  value: string;
  onChange: (id: string) => void;
  categories: { id: string; name: string }[];
}) {
  const [categories, setCategories] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    const data = new FormData();
    data.set("name", newName);
    startTransition(async () => {
      const result = await saveCategory(undefined, data);
      if (!result?.category) return setError(result?.error ?? "No se pudo crear");
      const created = result.category;
      setCategories((list) => (list.some((c) => c.id === created.id) ? list : [...list, created]));
      onChange(created.id);
      setCreating(false);
      setNewName("");
      setError("");
    });
  }

  if (creating) {
    return (
      <div>
        <div className="flex items-end gap-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            // Enter crea la categoría sin enviar el formulario de alrededor
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.preventDefault(), newName.trim() && create());
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Nombre de la categoría"
            className={inputClass}
          />
          <button type="button" onClick={create} disabled={pending || !newName.trim()} className="shrink-0 pb-2 text-[11px] tracking-[0.2em] text-bone uppercase disabled:opacity-40">
            {pending ? "Creando…" : "Crear"}
          </button>
          <button type="button" onClick={() => setCreating(false)} className="shrink-0 pb-2 text-[11px] tracking-[0.2em] text-mist uppercase">
            Cancelar
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        {/* Mientras se escribe, el formulario sigue mandando la categoría elegida */}
        {name && <input type="hidden" name={name} value={value} />}
      </div>
    );
  }

  return (
    <select
      name={name}
      value={value}
      onChange={(e) => (e.target.value === NEW ? setCreating(true) : onChange(e.target.value))}
      className={selectClass}
    >
      <option value="">Sin categoría</option>
      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      <option value={NEW}>+ Nueva categoría…</option>
    </select>
  );
}
