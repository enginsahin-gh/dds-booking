import { describe, it, expect, beforeEach } from 'vitest';

// Unit test for rate limiting logic (mirrors admin-users.ts implementation)

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

let rateLimitMap: Map<string, { count: number; resetAt: number }>;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  if (rateLimitMap.size > 1000) {
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return false;
  return true;
}

describe('Rate limiter', () => {
  beforeEach(() => {
    rateLimitMap = new Map();
  });

  it('allows first request', () => {
    expect(checkRateLimit('1.2.3.4')).toBe(true);
  });

  it('allows up to RATE_LIMIT requests', () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect(checkRateLimit('1.2.3.4')).toBe(true);
    }
  });

  it('blocks request RATE_LIMIT + 1', () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      checkRateLimit('1.2.3.4');
    }
    expect(checkRateLimit('1.2.3.4')).toBe(false);
  });

  it('different IPs have separate limits', () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      checkRateLimit('1.2.3.4');
    }
    expect(checkRateLimit('1.2.3.4')).toBe(false);
    expect(checkRateLimit('5.6.7.8')).toBe(true);
  });

  it('cleans up when map exceeds 1000 entries', () => {
    // Add 1001 expired entries
    const pastTime = Date.now() - RATE_WINDOW_MS - 1;
    for (let i = 0; i < 1001; i++) {
      rateLimitMap.set(`10.0.0.${i}`, { count: 1, resetAt: pastTime });
    }
    expect(rateLimitMap.size).toBe(1001);

    // Next call should trigger cleanup
    checkRateLimit('new-ip');
    expect(rateLimitMap.size).toBeLessThan(1001);
  });
});
