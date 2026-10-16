// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('next/server', () => ({ connection: vi.fn(async () => {}) }));

beforeEach(() => vi.clearAllMocks());

describe('GET /api/health', () => {
  it('answers 200 when the database answers', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers 503 without error details when the database fails', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('connect ECONNREFUSED db.example:6543'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ ok: false });
    expect(body).not.toContain('ECONNREFUSED');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
