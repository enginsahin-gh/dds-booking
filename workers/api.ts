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
import { handleScheduled } from './scheduled';

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

// Admin user management (requires owner auth)
app.get('/api/admin/users', listUsers);
app.post('/api/admin/invite-user', inviteUser);
app.post('/api/admin/remove-user', removeUser);
app.post('/api/admin/update-user-role', updateUserRole);
app.post('/api/admin/update-user-permissions', updateUserPermissions);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(env));
  },
};
