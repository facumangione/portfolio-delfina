import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { InstallForm } from "@/components/forms/AccountForms";
import { AuthLayout } from "@/components/forms/AuthLayout";

export const metadata: Metadata = { title: "Instalación" };
export const dynamic = "force-dynamic";

/*
 * Primer arranque en producción: si todavía no hay ningún administrador, esta
 * página permite crear el primero. En cuanto existe uno, redirige al login.
 * Después, desde Administración → Usuarios se crea la cuenta de la fotógrafa.
 */
export default async function InstallPage() {
  if (await db.user.count({ where: { role: "ADMIN" } })) redirect("/login");
  return (
    <AuthLayout>
      <p className="eyebrow mb-4">Primer arranque</p>
      <h1 className="mb-6 font-display text-6xl font-light">Instalación</h1>
      <p className="mb-12 text-sm leading-relaxed text-mist">
        Creá la cuenta de administrador. Después vas a poder crear la cuenta de la fotógrafa desde Administración → Usuarios.
      </p>
      <InstallForm />
    </AuthLayout>
  );
}
