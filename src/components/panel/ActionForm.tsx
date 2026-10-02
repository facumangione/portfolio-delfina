"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "./ui";

type State = { ok?: boolean; error?: string } | undefined;

/** Formulario con estado: muestra "Guardado" o el error que devuelva la acción. */
export function ActionForm({
  action, children, submitLabel = "Guardar", resetOnSuccess, className,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  children: React.ReactNode;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [flash, setFlash] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok) return;
    setFlash(true);
    if (resetOnSuccess) ref.current?.reset();
    const t = setTimeout(() => setFlash(false), 2500);
    return () => clearTimeout(t);
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="mt-8 flex items-center gap-6">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : submitLabel}</Button>
        <AnimatePresence>
          {flash && <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="eyebrow text-emerald-300/90!">Hecho</motion.span>}
          {state?.error && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-300">{state.error}</motion.span>}
        </AnimatePresence>
      </div>
    </form>
  );
}
