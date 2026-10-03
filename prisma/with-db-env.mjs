// Ejecuta un comando con DATABASE_URL y DATABASE_URL_UNPOOLED completadas
// (ver db-env.mjs). Uso: node prisma/with-db-env.mjs "prisma db push && next build"
import { spawnSync } from "node:child_process";
import { resolveDbEnv } from "./db-env.mjs";

const found = resolveDbEnv();
if (!process.env.DATABASE_URL) {
  console.error("\n[base de datos] No encontré ninguna variable con la conexión a PostgreSQL.");
  console.error("En Vercel: Storage → conectá la base de Neon a este proyecto y volvé a desplegar.\n");
  process.exit(1);
}
console.log(`[base de datos] Usando ${found.pooled} (y ${found.direct} para crear las tablas).`);
const result = spawnSync(process.argv.slice(2).join(" "), { stdio: "inherit", shell: true, env: process.env });
process.exit(result.status ?? 1);
