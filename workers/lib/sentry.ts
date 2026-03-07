import * as Sentry from '@sentry/cloudflare';
import type { Context } from 'hono';
import type { Env } from '../api';

let initialized = false;

export function initSentry(env: Env) {
  if (initialized) return;
  if (!env.SENTRY_DSN) return;

  const tracesSampleRate = env.SENTRY_TRACES_SAMPLE_RATE
    ? Number(env.SENTRY_TRACES_SAMPLE_RATE)
    : 0.05;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENV || 'production',
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.05,
  });

  initialized = true;
}

export function captureException(err: unknown, c?: Context, extra?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.captureException(err, {
    tags: c ? { path: c.req.path, method: c.req.method } : undefined,
    extra,
  });
}
