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
import { trialRegister, trialStatus } from './routes/trial';
import { subscriptionActivate, subscriptionWebhook, subscriptionPaymentWebhook, subscriptionStatus, subscriptionCancel } from './routes/subscription';
import { handleScheduled } from './scheduled';
import { handleTrialPause } from './scheduled-trial-pause';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MOLLIE_API_KEY: string;
  MOLLIE_APP_ID: string;
  MOLLIE_APP_SECRET: string;
  EMAIL_SECRET: string;
  RESEND_API_KEY: string;
  SITE_URL: string;      // Worker API base URL
  FRONTEND_URL: string;  // Pages frontend URL (admin dashboard)
};

const app = new Hono<{ Bindings: Env }>();

// CORS for widget embeds
app.use('/api/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'x-email-secret'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

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
app.post('/api/trial/register', trialRegister);
app.get('/api/trial/status', trialStatus);

// Subscription management
app.post('/api/subscription/activate', subscriptionActivate);
app.post('/api/subscription/webhook', subscriptionWebhook);
app.post('/api/subscription/payment-webhook', subscriptionPaymentWebhook);
app.get('/api/subscription/status', subscriptionStatus);
app.post('/api/subscription/cancel', subscriptionCancel);

// Admin user management (requires owner auth)
app.get('/api/admin/users', listUsers);
app.post('/api/admin/invite-user', inviteUser);
app.post('/api/admin/remove-user', removeUser);
app.post('/api/admin/update-user-role', updateUserRole);
app.post('/api/admin/update-user-permissions', updateUserPermissions);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Daily at 06:00 UTC: pause expired trials
    if (event.cron === '0 6 * * *') {
      ctx.waitUntil(handleTrialPause(env));
    } else {
      // Every 15 min: appointment reminders
      ctx.waitUntil(handleScheduled(env));
    }
  },
};
