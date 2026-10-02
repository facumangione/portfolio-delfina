"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { EMPTY_FILTERS, SORTS, type Facets, type Filters, type SortKey } from "./filters";
import { EASE_CINE } from "@/components/motion/easing";
import { cn } from "@/lib/utils";

/*
 * Barra de filtros minimalista:
 *  - Fila visible: categorías como texto, con un subrayado que se desliza
 *    (layoutId) hacia la opción activa; buscador; botón "Filtros"; orden.
 *  - Panel desplegable (altura animada) con tema, año, orientación y etiquetas.
 */

export function FilterBar({
  filters, setFilters, facets: f, count,
}: { filters: Filters; setFilters: (f: Filters) => void; facets: Facets; count: number }) {
  const [open, setOpen] = useState(Boolean(filters.tema || filters.etiqueta || filters.anio || filters.orientacion));
  const [sortOpen, setSortOpen] = useState(false);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const activeExtra = [filters.tema, filters.etiqueta, filters.anio, filters.orientacion].filter(Boolean).length;
  const dirty = JSON.stringify({ ...filters, orden: "recientes" }) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="mb-12 md:mb-16">
      <div className="flex flex-col gap-6 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        {/* Categorías */}
        <div className="-mx-1 flex gap-7 overflow-x-auto px-1 pb-1">
          {[{ slug: "", name: "Todo" }, ...f.categories].map((c) => {
            const active = filters.categoria === c.slug;
            return (
              <button
                key={c.slug || "all"}
                onClick={() => set({ categoria: c.slug })}
                className={cn("relative shrink-0 pb-2 text-sm transition-colors duration-500", active ? "text-bone" : "text-mist hover:text-bone")}
              >
                {c.name}
                {active && (
                  <motion.span layoutId="category-underline" className="absolute inset-x-0 -bottom-px h-px bg-bone" transition={{ duration: 0.6, ease: EASE_CINE }} />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="group relative flex items-center gap-2 border-b border-transparent pb-1 transition-colors focus-within:border-bone/40">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-mist" fill="none" stroke="currentColor" strokeWidth={1.3}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
            <input
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Buscar"
              className="w-28 bg-transparent text-sm text-bone placeholder:text-mist focus:w-44 focus:outline-none transition-[width] duration-500"
            />
          </label>

          <button onClick={() => setOpen((o) => !o)} className={cn("eyebrow flex items-center gap-2 transition-colors hover:text-bone", open && "text-bone!")}>
            Filtros{activeExtra > 0 && <span className="text-accent">· {activeExtra}</span>}
            <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.4 }} className="inline-block text-sm leading-none">+</motion.span>
          </button>

          {/* Selector de orden */}
          <div className="relative">
            <button onClick={() => setSortOpen((o) => !o)} onBlur={() => setTimeout(() => setSortOpen(false), 150)} className="eyebrow flex items-center gap-2 transition-colors hover:text-bone">
              Orden: <span className="text-bone">{SORTS[filters.orden]}</span>
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: EASE_CINE }}
                  className="absolute right-0 z-30 mt-3 w-52 border border-line bg-coal/95 py-2 backdrop-blur-xl"
                >
                  {(Object.keys(SORTS) as SortKey[]).map((k) => (
                    <li key={k}>
                      <button
                        onClick={() => (set({ orden: k }), setSortOpen(false))}
                        className={cn("w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/5", k === filters.orden ? "text-bone" : "text-mist")}
                      >
                        {SORTS[k]}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_CINE }}
            className="overflow-hidden"
          >
            <div className="grid gap-8 border-b border-line py-7 md:grid-cols-4">
              <Group label="Tema" values={f.themes} value={filters.tema} onChange={(tema) => set({ tema })} />
              <Group label="Año" values={f.years} value={filters.anio} onChange={(anio) => set({ anio })} />
              <Group
                label="Orientación"
                values={["horizontal", "vertical", "cuadrada"]}
                value={filters.orientacion}
                onChange={(o) => set({ orientacion: o as Filters["orientacion"] })}
              />
              <Group label="Etiquetas" values={f.tags} value={filters.etiqueta} onChange={(etiqueta) => set({ etiqueta })} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 flex items-center justify-between">
        <motion.p key={count} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow tabular-nums">
          {count} {count === 1 ? "fotografía" : "fotografías"}
        </motion.p>
        <AnimatePresence>
          {dirty && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setFilters({ ...EMPTY_FILTERS, orden: filters.orden })}
              className="eyebrow transition-colors hover:text-bone"
            >
              Limpiar filtros
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Group({ label, values, value, onChange }: { label: string; values: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="eyebrow mb-3">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const active = v === value;
          return (
            <button
              key={v}
              onClick={() => onChange(active ? "" : v)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs capitalize transition-all duration-500",
                active ? "border-bone bg-bone text-ink" : "border-line text-bone/70 hover:border-bone/40 hover:text-bone",
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
