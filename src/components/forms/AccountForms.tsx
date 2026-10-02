"use client";

import { useActionState } from "react";
import { installAdmin, updateAccount } from "@/app/cuenta/actions";
import { Field, FormError, SubmitButton } from "./Field";

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateAccount, undefined);
  return (
    <form action={action} className="space-y-8">
      <Field label="Nombre" name="name" defaultValue={name} required />
      <Field label="Email" name="email" type="email" defaultValue={email} required />
      <Field label="Nueva contraseña" name="password" type="password" autoComplete="new-password" hint="Dejala vacía para mantener la actual." />
      <Field label="Contraseña actual" name="current" type="password" autoComplete="current-password" required hint="Necesaria para confirmar cualquier cambio." />
      <FormError message={state?.error} />
      {state?.ok && <p className="text-sm text-emerald-300/90">Cambios guardados.</p>}
      <SubmitButton pending={pending}>Guardar</SubmitButton>
    </form>
  );
}

export function InstallForm() {
  const [state, action, pending] = useActionState(installAdmin, undefined);
  return (
    <form action={action} className="space-y-8">
      <Field label="Tu nombre" name="name" required />
      <Field label="Email" name="email" type="email" required />
      <Field label="Contraseña" name="password" type="password" required minLength={8} autoComplete="new-password" />
      <FormError message={state?.error} />
      <SubmitButton pending={pending}>Crear administrador</SubmitButton>
    </form>
  );
}
