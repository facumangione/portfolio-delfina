"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { Button, selectClass } from "./ui";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";
import { updateUser, type AdminState } from "@/app/admin/actions";

interface UserRow {
  id: string;
  role: string;
  active: boolean;
  canDownload: boolean;
}

/*
 * Fila editable de Administración → Usuarios.
 *
 * Cuando un formulario usa `action={...}`, React 19 lo vuelve a sus valores
 * iniciales después de guardar. Por eso la lista mostraba el rol VIEJO aunque
 * el nuevo ya estuviera guardado, y si después se tocaba "Guardar" otra vez en
 * esa fila, se volvía a guardar el rol viejo. Acá enviamos el formulario a
 * mano (onSubmit), que no lo reinicia, y los campos muestran siempre lo elegido.
 */
export function UserRowForm({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [state, setState] = useState<AdminState>();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const [canDownload, setCanDownload] = useState(user.canDownload);
  // Hay cambios sin guardar si lo elegido no coincide con lo que está en la base
  const dirty = role !== user.role || active !== user.active || canDownload !== user.canDownload;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => setState(await updateUser(undefined, data)));
      }}
      className="flex flex-1 flex-wrap items-center gap-6"
    >
      <input type="hidden" name="id" value={user.id} />
      {/* El administrador no puede cambiarse su propio rol (se quedaría sin acceso) */}
      {isSelf && <input type="hidden" name="role" value={role} />}
      <select
        name={isSelf ? undefined : "role"}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        disabled={isSelf}
        title={isSelf ? "No podés cambiar tu propio rol" : undefined}
        className={`${selectClass} w-40! disabled:opacity-50`}
        aria-label="Rol"
      >
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm text-mist">
        <input type="checkbox" name="active" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} className="accent-[#d8c3a5]" /> Activo
        {isSelf && <input type="hidden" name="active" value="on" />}
      </label>
      <label className="flex items-center gap-2 text-sm text-mist">
        <input type="checkbox" name="canDownload" checked={canDownload} onChange={(e) => setCanDownload(e.target.checked)} className="accent-[#d8c3a5]" /> Puede descargar
      </label>
      <Button variant={dirty ? "primary" : "ghost"} type="submit" disabled={!dirty || pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
      <AnimatePresence mode="wait">
        {state?.error ? (
          <motion.span key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-300">{state.error}</motion.span>
        ) : state?.ok && !dirty && !pending ? (
          <motion.span key="ok" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="eyebrow text-emerald-300/90!">Guardado</motion.span>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
