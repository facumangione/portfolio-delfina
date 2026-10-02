import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/AuthForm";
import { AuthLayout } from "@/components/forms/AuthLayout";
import { TLink } from "@/components/motion/PageTransition";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return (
    <AuthLayout>
      <p className="eyebrow mb-4">Nueva cuenta</p>
      <h1 className="mb-12 font-display text-6xl font-light">Crear cuenta</h1>
      <AuthForm mode="register" next={next} />
      <p className="mt-10 text-sm text-mist">
        ¿Ya tenés cuenta? <TLink href={`/login?next=${encodeURIComponent(next)}`} className="text-bone underline-offset-4 hover:underline">Ingresá</TLink>
      </p>
    </AuthLayout>
  );
}
