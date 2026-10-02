import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { AccountForm } from "@/components/forms/AccountForms";
import { AuthLayout } from "@/components/forms/AuthLayout";

export const metadata: Metadata = { title: "Mi cuenta" };
export const dynamic = "force-dynamic";

// Cada persona puede cambiar su nombre, email y contraseña.
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/cuenta");
  return (
    <AuthLayout>
      <p className="eyebrow mb-4">{ROLE_LABELS[user.role]}</p>
      <h1 className="mb-12 font-display text-6xl font-light">Mi cuenta</h1>
      <AccountForm name={user.name} email={user.email} />
    </AuthLayout>
  );
}
