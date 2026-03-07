import * as Sentry from '@sentry/react';

let initialized = false;

function getSampleRate(): number {
  const raw = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE;
  if (!raw) return 0.05;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0.05;
}

function getDsn(scope: 'app' | 'widget') {
  if (scope === 'widget') {
    return import.meta.env.VITE_SENTRY_WIDGET_DSN || import.meta.env.VITE_SENTRY_DSN;
  }
  return import.meta.env.VITE_SENTRY_DSN;
}

export function initSentry(scope: 'app' | 'widget') {
  if (initialized) return;
  const dsn = getDsn(scope);
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: getSampleRate(),
    beforeSend(event) {
      event.tags = { ...(event.tags || {}), scope };
      return event;
    },
  });

  Sentry.setTag('scope', scope);
  initialized = true;
}

export function captureException(error: unknown, extra?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.captureException(error, { extra });
}

export function setUser(user?: { id?: string; email?: string }) {
  if (!initialized) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email });
}
