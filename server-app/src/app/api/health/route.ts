import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Liveness plus database connectivity (NFR-11). The Docker healthcheck calls
 * this, so it must stay cheap and must not require authentication.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      database: 'reachable',
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'degraded',
        database: 'unreachable',
        error: error instanceof Error ? error.message : String(error),
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
