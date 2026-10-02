import { PrismaClient } from "@prisma/client";

// En desarrollo Next recarga los módulos en caliente; guardamos el cliente en
// globalThis para no abrir una conexión nueva en cada recarga.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
