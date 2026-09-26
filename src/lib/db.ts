import { PrismaClient } from "@prisma/client";

// Singleton del cliente de Prisma — evita agotar el pool de conexiones con
// cada hot-reload de `next dev` (Next.js recarga módulos en desarrollo, y
// sin este patrón se crearía un PrismaClient nuevo en cada recarga).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
