import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createBooking } from './routes/create-booking';
import { createPayment } from './routes/create-payment';
import { mollieWebhook } from './routes/mollie-webhook';
import { cancelBooking } from './routes/cancel-booking';
import { paymentStatus } from './routes/payment-status';
import { sendEmail } from './routes/send-email';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MOLLIE_API_KEY: string;
  MOLLIE_APP_ID: string;
  MOLLIE_APP_SECRET: string;
  EMAIL_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  SITE_URL: string;
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

export default app;
