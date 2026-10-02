// Crea (o actualiza) una cuenta desde la terminal, sin cargar fotos de ejemplo.
//
//   npm run usuario -- --rol fotografa --nombre "Delfina" --email delfina@mail.com
//   npm run usuario -- --rol admin --nombre "Facu" --email facu@mail.com
//
// Si no pasás --password, la pide por teclado. Si el email ya existe, actualiza
// el nombre, el rol y la contraseña (sirve también para recuperar el acceso).

import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const ROLES: Record<string, string> = {
  admin: "ADMIN", administrador: "ADMIN",
  fotografa: "PHOTOGRAPHER", "fotógrafa": "PHOTOGRAPHER", fotografo: "PHOTOGRAPHER",
  usuario: "USER",
};

async function main() {
  const { values } = parseArgs({
    options: { rol: { type: "string", default: "usuario" }, nombre: { type: "string" }, email: { type: "string" }, password: { type: "string" } },
  });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q: string) => (await rl.question(q)).trim();

  const role = ROLES[(values.rol ?? "").toLowerCase()];
  if (!role) throw new Error(`Rol inválido: ${values.rol}. Usá admin, fotografa o usuario.`);
  const email = (values.email ?? (await ask("Email: "))).toLowerCase();
  const name = values.nombre ?? (await ask("Nombre: "));
  const password = values.password ?? (await ask("Contraseña (mínimo 8 caracteres): "));
  rl.close();
  if (!email.includes("@")) throw new Error("Email inválido.");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  const db = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.upsert({
    where: { email },
    create: { email, name, role, passwordHash },
    update: { name, role, passwordHash, active: true },
  });
  await db.$disconnect();
  console.log(`✓ Cuenta lista: ${user.name} <${user.email}> · rol ${role}`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
