import type { Context } from 'hono';

type LogLevel = 'info' | 'warn' | 'error';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/g;

function maskEmail(value: string): string {
  return value.replace(EMAIL_REGEX, (match) => {
    const [name, domain] = match.split('@');
    const maskedName = name ? `${name[0]}***` : '***';
    const parts = domain.split('.');
    const domainName = parts[0] ? `${parts[0][0]}***` : '***';
    const tld = parts.slice(1).join('.') || '';
    return `${maskedName}@${domainName}${tld ? `.${tld}` : ''}`;
  });
}

function maskPhone(value: string): string {
  return value.replace(PHONE_REGEX, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 6) return match;
    const suffix = digits.slice(-2);
    return `***${suffix}`;
  });
}

function sanitizeString(value: string): string {
  return maskPhone(maskEmail(value));
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      out[key] = sanitizeValue(val);
    });
    return out;
  }
  return String(value);
}

function baseMeta(c?: Context) {
  if (!c) return {};
  return {
    path: c.req.path,
    method: c.req.method,
    ray: c.req.header('cf-ray') || undefined,
  };
}

function write(level: LogLevel, message: string, c?: Context, data?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    ...baseMeta(c),
    data: data ? sanitizeValue(data) : undefined,
    timestamp: new Date().toISOString(),
  };

  const out = JSON.stringify(payload);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export function logInfo(c: Context | undefined, message: string, data?: Record<string, unknown>) {
  write('info', message, c, data);
}

export function logWarn(c: Context | undefined, message: string, data?: Record<string, unknown>) {
  write('warn', message, c, data);
}

export function logError(c: Context | undefined, message: string, data?: Record<string, unknown>) {
  write('error', message, c, data);
}
