// Se ejecuta antes de arrancar el servidor (npm start).
// Si falta una variable obligatoria, corta con un mensaje claro en vez de
// mostrar "Application error" en el sitio.
import fs from "node:fs";

// En la computadora las variables vienen del archivo .env (Prisma y Next lo leen solos).
if (fs.existsSync(".env")) process.exit(0);

const required = {
  DATABASE_URL: "conexión a la base PostgreSQL",
  DATABASE_URL_UNPOOLED: "conexión directa a la base (puede ser la misma que DATABASE_URL)",
  AUTH_SECRET: "una frase larga al azar para firmar las sesiones",
};
const missing = Object.keys(required).filter((key) => !process.env[key]);

if (missing.length) {
  console.error("\n[arranque] Faltan variables de entorno:");
  for (const key of missing) console.error(`  - ${key}: ${required[key]}`);
  console.error("Cargalas en la configuración del servicio (Environment / Variables) y volvé a desplegar.\n");
  process.exit(1);
}
if (!process.env.AUTH_TRUST_HOST) {
  console.warn("[arranque] Falta AUTH_TRUST_HOST=true: el ingreso puede fallar detrás del proxy del servidor.");
}
