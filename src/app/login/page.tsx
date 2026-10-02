import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/AuthForm";
import { AuthLayout } from "@/components/forms/AuthLayout";
import { TLink } from "@/components/motion/PageTransition";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  // Sitio recién instalado, sin administrador: lo mandamos a crear el primero
  if ((await db.user.count({ where: { role: "ADMIN" } })) === 0) redirect("/instalar");
  return (
    <AuthLayout>
      <p className="eyebrow mb-4">Acceso</p>
      <h1 className="mb-12 font-display text-6xl font-light">Ingresar</h1>
      <AuthForm mode="login" next={next} />
      <p className="mt-10 text-sm text-mist">
        ¿No tenés cuenta?{" "}
        <TLink href={`/registro?next=${encodeURIComponent(next)}`} className="text-bone underline-offset-4 hover:underline">Creá una</TLink>{" "}
        para guardar favoritos y descargar en alta resolución.
      </p>
    </AuthLayout>
  );
}
