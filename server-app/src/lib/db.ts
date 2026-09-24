import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@/generated/prisma/client';
import { env } from '@/lib/env';

/**
 * Prisma 7 connects through a driver adapter rather than a URL in the schema.
 * The adapter is constructed eagerly but does not open a connection until the
 * first query, so importing this module is safe during `next build`.
 */
function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });
  return new PrismaClient({ adapter });
}

// Next.js hot-reloads modules in development, which would otherwise leak a new
// connection pool on every edit.
const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prismaClient ?? createClient();

if (!env.isProduction) {
  globalForPrisma.prismaClient = prisma;
}

/**
 * Transaction handle. Services that must write an audit event atomically with
 * their change accept this so the caller controls the transaction boundary
 * (ARCHITECTURE.md section 4, rule 2).
 */
export type Tx = Prisma.TransactionClient;
