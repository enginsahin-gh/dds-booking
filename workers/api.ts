import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createBooking } from './routes/create-booking';
import { createPayment } from './routes/create-payment';
import { mollieWebhook } from './routes/mollie-webhook';
import { cancelBooking } from './routes/cancel-booking';
import { paymentStatus } from './routes/payment-status';
import { sendEmail } from './routes/send-email';
import { submitLead } from './routes/submit-lead';
import { customerCancel } from './routes/customer-cancel';
import { mollieConnect, mollieCallback, mollieDisconnect } from './routes/mollie-connect';
import { inviteUser, removeUser, updateUserRole, updateUserPermissions, listUsers } from './routes/admin-users';
import { trialApply, trialApprove, trialRegister, trialStatus } from './routes/trial';
import { subscriptionActivate, subscriptionWebhook, subscriptionPaymentWebhook, subscriptionStatus, subscriptionCancel } from './routes/subscription';
import { googleConnect, googleCallback, googleDisconnect, googleStatus, googleSyncToggle, googleWebhook } from './routes/google-calendar';
import { handleScheduled } from './scheduled';
import { handleTrialPause } from './scheduled-trial-pause';
import { waitlistJoin, waitlistNotify, waitlistEntries, waitlistCancel, handleExpiredWaitlist } from './routes/waitlist';
import { getCustomerProfile, upsertCustomerProfile } from './routes/customer-profile';
import { getCustomerProfileGlobal, updateCustomerProfileGlobal } from './routes/customer-profile-global';
import { customerAppointments } from './routes/customer-appointments';
import { platformMe, platformSalons, platformUpdateSalon } from './routes/platform';
import { logError } from './lib/logger';
import * as Sentry from '@sentry/cloudflare';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MOLLIE_API_KEY: string;
  MOLLIE_APP_ID: string;
  MOLLIE_APP_SECRET: string;
  MOLLIE_WEBHOOK_SECRET?: string;
  EMAIL_SECRET: string;
  RESEND_API_KEY: string;
  SITE_URL: string;      // Worker API base URL
  FRONTEND_URL: string;  // Pages frontend URL (admin dashboard)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SENTRY_DSN?: string;
  SENTRY_ENV?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  RATE_LIMIT_KV?: KVNamespace;
};

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  logError(c, 'Unhandled error', { message: err?.message || String(err) });
  try {
    Sentry.captureException(err, { tags: { path: c.req.path, method: c.req.method } });
  } catch (_) {
    // ignore sentry failures
  }
  return c.json({ error: 'Internal server error' }, 500);
});

// SEC-007: Restrict CORS to allowed origins (no wildcard)
app.use('/api/*', cors({
  origin: (origin) => {
    const allowed = [
      'https://mijn.bellure.nl',
      'https://booking.bellure.nl',
      'https://bellure.nl',
      'https://salon-amara.bellure.nl',
    ];
    // Widget can be embedded on any salon domain
    if (origin && (allowed.includes(origin) || origin.endsWith('.bellure.nl') || origin.endsWith('.netlify.app'))) {
      return origin;
    }
    return 'https://mijn.bellure.nl'; // default
  },
  // SEC-010: Removed x-email-secret from allowHeaders
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

// SEC-017: Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-XSS-Protection', '0');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.post('/api/create-booking', createBooking);
app.post('/api/create-payment', createPayment);
app.post('/api/mollie-webhook', mollieWebhook);
app.post('/api/cancel-booking', cancelBooking);
app.get('/api/payment-status', paymentStatus);
app.post('/api/send-email', sendEmail);
app.post('/api/submit-lead', submitLead);
app.get('/api/cancel', customerCancel);
app.post('/api/cancel', customerCancel);
app.get('/api/mollie/connect', mollieConnect);
app.get('/api/mollie/callback', mollieCallback);
app.post('/api/mollie/disconnect', mollieDisconnect);

// Trial / onboarding
app.post('/api/trial/apply', trialApply);
app.get('/api/trial/approve', trialApprove);
app.post('/api/trial/register', trialRegister);
app.get('/api/trial/status', trialStatus);

// Subscription management
app.post('/api/subscription/activate', subscriptionActivate);
app.post('/api/subscription/webhook', subscriptionWebhook);
app.post('/api/subscription/payment-webhook', subscriptionPaymentWebhook);
app.get('/api/subscription/status', subscriptionStatus);
app.post('/api/subscription/cancel', subscriptionCancel);

// Waitlist
app.post('/api/waitlist/join', waitlistJoin);
app.post('/api/waitlist/notify', waitlistNotify);
app.get('/api/waitlist/entries', waitlistEntries);
app.post('/api/waitlist/cancel', waitlistCancel);

// Customer login (profile)
app.get('/api/customers/profile', getCustomerProfile);
app.post('/api/customers/profile', upsertCustomerProfile);
app.get('/api/customers/profile-global', getCustomerProfileGlobal);
app.post('/api/customers/profile-global', updateCustomerProfileGlobal);
app.get('/api/customers/appointments', customerAppointments);

// Google Calendar integration
app.get('/api/google/connect', googleConnect);
app.get('/api/google/callback', googleCallback);
app.post('/api/google/disconnect', googleDisconnect);
app.get('/api/google/status', googleStatus);
app.post('/api/google/sync-toggle', googleSyncToggle);
app.post('/api/google/webhook', googleWebhook);

// Admin user management (requires owner auth)
app.get('/api/admin/users', listUsers);
app.post('/api/admin/invite-user', inviteUser);
app.post('/api/admin/remove-user', removeUser);
app.post('/api/admin/update-user-role', updateUserRole);
app.post('/api/admin/update-user-permissions', updateUserPermissions);

// Platform admin (Bellure beheer)
app.get('/api/platform/me', platformMe);
app.get('/api/platform/salons', platformSalons);
app.post('/api/platform/update-salon', platformUpdateSalon);

function getTracesSampleRate(env: Env): number {
  const raw = env.SENTRY_TRACES_SAMPLE_RATE;
  if (!raw) return 0.05;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0.05;
}

const handler = {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Daily at 06:00 UTC: pause expired trials
    if (event.cron === '0 6 * * *') {
      ctx.waitUntil(handleTrialPause(env));
    } else {
      // Every 15 min: appointment reminders + expired waitlist cleanup
      ctx.waitUntil(handleScheduled(env));
      ctx.waitUntil(handleExpiredWaitlist(env));
    }
  },
  // Expose Hono error handler for Sentry Hono integration
  errorHandler: app.errorHandler,
};

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENV || 'production',
    tracesSampleRate: getTracesSampleRate(env),
  }),
  handler
);
