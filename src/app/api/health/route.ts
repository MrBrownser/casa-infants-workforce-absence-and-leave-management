import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public health check for the uptime monitor (see src/proxy.ts). It answers
// only ok or not: no data, no error details. Polling it also keeps a Supabase
// Free project from pausing for inactivity.
const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  // Always at request time, never prerendered (also under Cache Components).
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error('Health check: database query failed', error);
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
