"use client";

import { useActionState } from "react";
import { login, register } from "@/app/(auth)/actions";
import { Field, FormError, SubmitButton } from "./Field";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="next" value={next} />
      {mode === "register" && <Field label="Nombre" name="name" required autoComplete="name" />}
      {/* key + defaultValue: al fallar, React limpia el formulario; así el email se conserva */}
      <Field key={state?.email ?? ""} label="Email" name="email" type="email" required autoComplete="email" defaultValue={state?.email} />
      <Field label="Contraseña" name="password" type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"} />
      <FormError message={state?.error} />
      <SubmitButton pending={pending}>{mode === "login" ? "Ingresar" : "Crear cuenta"}</SubmitButton>
    </form>
  );
}
