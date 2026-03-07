import type { Context } from 'hono';
import type { Env } from '../api';

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  reset: number;
}

function getClientIp(c: Context): string {
  const header = c.req.header('cf-connecting-ip')
    || c.req.header('x-forwarded-for')
    || '';
  return header.split(',')[0].trim() || 'unknown';
}

export async function rateLimit(
  c: Context<{ Bindings: Env }>,
  scope: string,
  limit: number,
  windowSec: number,
  keySuffix?: string
): Promise<RateLimitResult> {
  const kv = c.env.RATE_LIMIT_KV;
  if (!kv) {
    return { ok: true, remaining: limit, reset: Math.floor(Date.now() / 1000) + windowSec };
  }

  const ip = getClientIp(c);
  const suffix = keySuffix ? `:${keySuffix}` : '';
  const key = `${scope}:${ip}${suffix}`;

  const now = Math.floor(Date.now() / 1000);
  const stored = await kv.get(key, 'json') as { count: number; reset: number } | null;

  if (!stored || stored.reset <= now) {
    const reset = now + windowSec;
    await kv.put(key, JSON.stringify({ count: 1, reset }), { expirationTtl: windowSec });
    return { ok: true, remaining: limit - 1, reset };
  }

  if (stored.count >= limit) {
    return { ok: false, remaining: 0, reset: stored.reset };
  }

  const next = { count: stored.count + 1, reset: stored.reset };
  await kv.put(key, JSON.stringify(next), { expirationTtl: stored.reset - now });
  return { ok: true, remaining: limit - next.count, reset: stored.reset };
}
