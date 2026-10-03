/*
 * Encuentra la conexión a la base aunque las variables tengan otro nombre.
 *
 * La integración de Neon en Vercel puede crear DATABASE_URL, POSTGRES_URL,
 * POSTGRES_PRISMA_URL… y, si se le pone un prefijo (por ejemplo "STORAGE"),
 * STORAGE_DATABASE_URL, STORAGE_URL, etc. Prisma sólo lee DATABASE_URL y
 * DATABASE_URL_UNPOOLED, así que acá las completamos a partir de lo que haya.
 * Si no hay conexión directa ("unpooled"), se usa la misma que la normal.
 */

const isPostgres = (value) => /^postgres(ql)?:\/\//.test(value ?? "");
const isDirect = (key) => /UNPOOLED|NON_POOLING/.test(key);

export function resolveDbEnv(env = process.env) {
  const keys = Object.keys(env).filter((k) => isPostgres(env[k])).sort();
  const pick = (exact, suffixes, direct) =>
    exact.find((k) => isPostgres(env[k])) ??
    keys.find((k) => isDirect(k) === direct && suffixes.some((s) => k.endsWith(s))) ??
    keys.find((k) => isDirect(k) === direct);

  const pooled = pick(["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"], ["_DATABASE_URL", "_PRISMA_URL", "_POSTGRES_URL", "_URL"], false);
  const direct = pick(["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"], ["_DATABASE_URL_UNPOOLED", "_URL_UNPOOLED", "_URL_NON_POOLING"], true);

  if (!isPostgres(env.DATABASE_URL) && (pooled || direct)) env.DATABASE_URL = env[pooled ?? direct];
  if (!isPostgres(env.DATABASE_URL_UNPOOLED) && env.DATABASE_URL) env.DATABASE_URL_UNPOOLED = env[direct ?? "DATABASE_URL"];
  return { pooled: pooled ?? direct ?? null, direct: direct ?? pooled ?? null };
}
