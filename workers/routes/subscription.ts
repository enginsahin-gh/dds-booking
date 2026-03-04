import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { verifyAuth } from '../lib/auth';

// Plan prices in EUR (string format for Mollie)
const PLAN_PRICES: Record<string, string> = {
  booking_standalone: '29.98',
  booking_website: '14.99',
  website_basic: '19.99',
};

const PLAN_LABELS: Record<string, string> = {
  booking_standalone: 'Booking Standalone',
  booking_website: 'Booking + Website',
  website_basic: 'Website Basic',
};

// Convert EUR string to cents integer
function eurToCents(eur: string): number {
  return Math.round(parseFloat(eur) * 100);
}

// Helper: Mollie API fetch
async function mollieRequest(
  apiKey: string,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<any> {
  const res = await fetch(`https://api.mollie.com/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`Mollie ${method} ${path} error:`, JSON.stringify(data));
    throw new Error(data?.detail || data?.title || 'Mollie API error');
  }
  return data;
}

/**
 * POST /api/subscription/activate
 * Body: { salonId, planType }
 * Auth: Bearer token (owner)
 * Creates Mollie customer (if needed) and first payment, returns redirect URL.
 */
export async function subscriptionActivate(c: Context<{ Bindings: Env }>) {
  const owner = await verifyAuth(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const { salonId, planType } = await c.req.json();

  if (!salonId || !planType) {
    return c.json({ error: 'salonId en planType zijn verplicht' }, 400);
  }

  // Verify the owner actually owns this salon
  if (salonId !== owner.salonId) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const price = PLAN_PRICES[planType];
  if (!price) {
    return c.json({ error: 'Ongeldig planType' }, 400);
  }

  const supabase = getSupabase(c.env);

  // Fetch salon
  const { data: salon, error: salonErr } = await supabase
    .from('salons')
    .select('id, name, subscription_status, mollie_customer_id')
    .eq('id', salonId)
    .single();

  if (salonErr || !salon) {
    return c.json({ error: 'Salon niet gevonden' }, 404);
  }

  // Check: no active subscription already
  if (salon.subscription_status === 'active') {
    return c.json({ error: 'Er is al een actief abonnement' }, 400);
  }

  // Get owner email for Mollie customer
  const { data: ownerUser } = await supabase
    .from('salon_users')
    .select('email')
    .eq('salon_id', salonId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  const ownerEmail = ownerUser?.email || '';
  const mollieKey = c.env.MOLLIE_API_KEY;

  // Step 1: Create Mollie Customer if not exists
  let customerId = salon.mollie_customer_id;

  if (!customerId) {
    const customer = await mollieRequest(mollieKey, 'POST', '/customers', {
      name: salon.name,
      email: ownerEmail,
      metadata: JSON.stringify({ salonId }),
    });

    customerId = customer.id;

    // Store customer ID
    await supabase
      .from('salons')
      .update({ mollie_customer_id: customerId })
      .eq('id', salonId);
  }

  // Step 2: Create first payment to obtain mandate
  const siteUrl = c.env.SITE_URL || 'https://api.bellure.nl';
  const frontendUrl = c.env.FRONTEND_URL || 'https://mijn.bellure.nl';

  const payment = await mollieRequest(mollieKey, 'POST', '/payments', {
    amount: { value: price, currency: 'EUR' },
    customerId,
    sequenceType: 'first',
    description: `Bellure abonnement activatie - ${PLAN_LABELS[planType] || planType}`,
    redirectUrl: `${frontendUrl}/admin/instellingen?subscription=activated`,
    webhookUrl: `${siteUrl}/api/subscription/webhook`,
    metadata: { salonId, planType },
  });

  return c.json({ paymentUrl: payment._links.checkout.href });
}

/**
 * POST /api/subscription/webhook
 * Mollie calls this after the first payment completes.
 * On success: creates the recurring subscription.
 */
export async function subscriptionWebhook(c: Context<{ Bindings: Env }>) {
  // Mollie sends form-encoded body with id=tr_xxx
  const formData = await c.req.parseBody();
  const paymentId = formData.id as string;

  if (!paymentId) {
    return c.json({ error: 'Missing payment id' }, 400);
  }

  const mollieKey = c.env.MOLLIE_API_KEY;

  // Fetch the payment from Mollie
  const payment = await mollieRequest(mollieKey, 'GET', `/payments/${paymentId}`);
  const { salonId, planType } = payment.metadata || {};

  if (!salonId || !planType) {
    console.error('Subscription webhook: missing metadata', payment.metadata);
    return c.text('OK');
  }

  const price = PLAN_PRICES[planType];
  if (!price) {
    console.error('Subscription webhook: unknown planType', planType);
    return c.text('OK');
  }

  const supabase = getSupabase(c.env);

  // Log the payment
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabase.from('subscription_payments').insert({
    salon_id: salonId,
    mollie_payment_id: paymentId,
    amount_cents: eurToCents(price),
    status: payment.status,
    plan_type: planType,
    period_start: now.toISOString(),
    period_end: periodEnd.toISOString(),
    failed_at: payment.status === 'failed' ? now.toISOString() : null,
  });

  if (payment.status !== 'paid') {
    console.log(`Subscription first payment ${paymentId} status: ${payment.status}`);
    return c.text('OK');
  }

  // Payment successful — create the recurring subscription
  const customerId = payment.customerId;
  const siteUrl = c.env.SITE_URL || 'https://api.bellure.nl';

  try {
    // Verify mandate exists
    const mandates = await mollieRequest(mollieKey, 'GET', `/customers/${customerId}/mandates`);
    const validMandate = mandates._embedded?.mandates?.find(
      (m: any) => m.status === 'valid' || m.status === 'pending'
    );

    if (!validMandate) {
      console.error('No valid mandate found for customer', customerId);
      return c.text('OK');
    }

    // Create subscription
    const subscription = await mollieRequest(
      mollieKey,
      'POST',
      `/customers/${customerId}/subscriptions`,
      {
        amount: { value: price, currency: 'EUR' },
        interval: '1 month',
        description: `Bellure ${PLAN_LABELS[planType] || planType}`,
        webhookUrl: `${siteUrl}/api/subscription/payment-webhook`,
        metadata: { salonId, planType },
      }
    );

    // Update salon
    await supabase
      .from('salons')
      .update({
        subscription_status: 'active',
        mollie_subscription_id: subscription.id,
        plan_type: planType,
        subscription_activated_at: now.toISOString(),
        subscription_past_due_at: null,
      })
      .eq('id', salonId);

    console.log(`Subscription created for salon ${salonId}: ${subscription.id}`);

    // Send confirmation email
    await sendSubscriptionEmail(c.env, salonId, 'activated');
  } catch (err) {
    console.error('Failed to create subscription:', err);
  }

  return c.text('OK');
}

/**
 * POST /api/subscription/payment-webhook
 * Mollie calls this for each recurring payment.
 */
export async function subscriptionPaymentWebhook(c: Context<{ Bindings: Env }>) {
  const formData = await c.req.parseBody();
  const paymentId = formData.id as string;

  if (!paymentId) {
    return c.json({ error: 'Missing payment id' }, 400);
  }

  const mollieKey = c.env.MOLLIE_API_KEY;
  const payment = await mollieRequest(mollieKey, 'GET', `/payments/${paymentId}`);
  const { salonId, planType } = payment.metadata || {};

  if (!salonId) {
    console.error('Payment webhook: missing salonId in metadata');
    return c.text('OK');
  }

  const price = PLAN_PRICES[planType] || '0.00';
  const supabase = getSupabase(c.env);
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Log payment
  await supabase.from('subscription_payments').insert({
    salon_id: salonId,
    mollie_payment_id: paymentId,
    amount_cents: eurToCents(price),
    status: payment.status,
    plan_type: planType || 'unknown',
    period_start: now.toISOString(),
    period_end: periodEnd.toISOString(),
    failed_at: payment.status === 'failed' ? now.toISOString() : null,
  });

  if (payment.status === 'paid') {
    // Successful recurring payment — ensure salon is active
    await supabase
      .from('salons')
      .update({
        subscription_status: 'active',
        subscription_past_due_at: null,
      })
      .eq('id', salonId);

    console.log(`Recurring payment successful for salon ${salonId}`);
  } else if (payment.status === 'failed' || payment.status === 'expired') {
    // Failed payment — mark as past_due with 7-day grace period
    const { data: salon } = await supabase
      .from('salons')
      .select('subscription_status, subscription_past_due_at')
      .eq('id', salonId)
      .single();

    // Only set past_due_at if not already set (preserve first failure date)
    if (salon && salon.subscription_status !== 'past_due') {
      await supabase
        .from('salons')
        .update({
          subscription_status: 'past_due',
          subscription_past_due_at: now.toISOString(),
        })
        .eq('id', salonId);

      // Send warning email
      await sendSubscriptionEmail(c.env, salonId, 'payment_failed');
    }

    console.log(`Recurring payment failed for salon ${salonId}: ${payment.status}`);
  }

  return c.text('OK');
}

/**
 * GET /api/subscription/status
 * Auth: Bearer token (owner)
 * Returns current subscription info.
 */
export async function subscriptionStatus(c: Context<{ Bindings: Env }>) {
  const owner = await verifyAuth(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase(c.env);

  const { data: salon } = await supabase
    .from('salons')
    .select(
      'subscription_status, plan_type, mollie_subscription_id, subscription_activated_at, subscription_past_due_at, trial_ends_at'
    )
    .eq('id', owner.salonId)
    .single();

  if (!salon) {
    return c.json({ error: 'Salon niet gevonden' }, 404);
  }

  const price = salon.plan_type ? PLAN_PRICES[salon.plan_type] || null : null;

  // Try to get next payment date from Mollie if subscription is active
  let nextPaymentDate: string | null = null;

  if (salon.mollie_subscription_id && salon.subscription_status === 'active') {
    try {
      // We need the customer ID to query the subscription
      const { data: salonFull } = await supabase
        .from('salons')
        .select('mollie_customer_id')
        .eq('id', owner.salonId)
        .single();

      if (salonFull?.mollie_customer_id) {
        const sub = await mollieRequest(
          c.env.MOLLIE_API_KEY,
          'GET',
          `/customers/${salonFull.mollie_customer_id}/subscriptions/${salon.mollie_subscription_id}`
        );
        nextPaymentDate = sub.nextPaymentDate || null;
      }
    } catch {
      // Non-critical: just omit next payment date
    }
  }

  return c.json({
    status: salon.subscription_status,
    planType: salon.plan_type,
    planLabel: salon.plan_type ? PLAN_LABELS[salon.plan_type] || salon.plan_type : null,
    amount: price,
    amountCents: price ? eurToCents(price) : null,
    nextPaymentDate,
    activatedAt: salon.subscription_activated_at,
    pastDueAt: salon.subscription_past_due_at,
    trialEndsAt: salon.trial_ends_at,
  });
}

/**
 * POST /api/subscription/cancel
 * Auth: Bearer token (owner)
 * Cancels the Mollie subscription.
 */
export async function subscriptionCancel(c: Context<{ Bindings: Env }>) {
  const owner = await verifyAuth(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase(c.env);

  const { data: salon } = await supabase
    .from('salons')
    .select('mollie_customer_id, mollie_subscription_id, subscription_status')
    .eq('id', owner.salonId)
    .single();

  if (!salon) {
    return c.json({ error: 'Salon niet gevonden' }, 404);
  }

  if (!salon.mollie_subscription_id) {
    return c.json({ error: 'Geen actief abonnement gevonden' }, 400);
  }

  if (salon.subscription_status === 'cancelled') {
    return c.json({ error: 'Abonnement is al opgezegd' }, 400);
  }

  // Cancel subscription at Mollie
  try {
    await mollieRequest(
      c.env.MOLLIE_API_KEY,
      'DELETE',
      `/customers/${salon.mollie_customer_id}/subscriptions/${salon.mollie_subscription_id}`
    );
  } catch (err) {
    console.error('Mollie cancel error:', err);
    // Continue anyway — subscription might already be cancelled at Mollie
  }

  // Update salon status
  await supabase
    .from('salons')
    .update({
      subscription_status: 'cancelled',
    })
    .eq('id', owner.salonId);

  // Send cancellation email
  await sendSubscriptionEmail(c.env, owner.salonId, 'cancelled');

  return c.json({ success: true });
}

// ---- Email helper ----

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type EmailType = 'activated' | 'payment_failed' | 'cancelled' | 'paused';

async function sendSubscriptionEmail(env: Env, salonId: string, type: EmailType): Promise<void> {
  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('sendSubscriptionEmail: RESEND_API_KEY not configured');
    return;
  }

  const supabase = getSupabase(env);

  const { data: salon } = await supabase
    .from('salons')
    .select(
      'name, brand_color, brand_color_text, brand_gradient_enabled, brand_gradient_from, brand_gradient_to, brand_gradient_direction, logo_url, email_footer_text'
    )
    .eq('id', salonId)
    .single();

  if (!salon) return;

  // Get owner email
  const { data: ownerUser } = await supabase
    .from('salon_users')
    .select('email')
    .eq('salon_id', salonId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  if (!ownerUser?.email) return;

  const frontendUrl = env.FRONTEND_URL || 'https://mijn.bellure.nl';
  const brandColor = salon.brand_color || '#8B5CF6';
  const brandColorText = salon.brand_color_text || '#FFFFFF';
  const gradientEnabled = salon.brand_gradient_enabled || false;
  const gradientFrom = salon.brand_gradient_from || brandColor;
  const gradientTo = salon.brand_gradient_to || '#6366F1';
  const gradientDir = salon.brand_gradient_direction || '135deg';

  const headerBg = gradientEnabled
    ? `background-color:${brandColor};background:linear-gradient(${gradientDir},${gradientFrom},${gradientTo});`
    : `background:${brandColor};`;

  const logoHtml = salon.logo_url
    ? `<img src="${esc(salon.logo_url)}" alt="${esc(salon.name)}" style="max-height:48px;max-width:180px;display:block;margin:0 auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:${brandColorText};letter-spacing:-0.5px;">${esc(salon.name)}</span>`;

  const footerLine = salon.email_footer_text
    ? `<p style="color:#94A3B8;font-size:13px;margin:8px 0 0;font-style:italic;">${esc(salon.email_footer_text)}</p>`
    : '';

  const btnBg = gradientEnabled
    ? `background-color:${brandColor};background:linear-gradient(${gradientDir},${gradientFrom},${gradientTo});`
    : `background:${brandColor};`;

  let subject: string;
  let content: string;

  switch (type) {
    case 'activated':
      subject = 'Je Bellure abonnement is geactiveerd';
      content = `
        <h2 style="color:${brandColor};font-size:22px;margin:0 0 16px;">Abonnement geactiveerd!</h2>
        <p style="font-size:15px;color:#475569;line-height:1.6;">
          Goed nieuws! Je abonnement voor <strong>${esc(salon.name)}</strong> is succesvol geactiveerd.
          Je boekingssysteem is nu volledig operationeel.
        </p>
        <p style="font-size:15px;color:#475569;line-height:1.6;">
          Het maandelijkse bedrag wordt automatisch geincasseerd. Je kunt je abonnement
          op elk moment beheren via je dashboard.
        </p>
        <div style="margin:28px 0;text-align:center;">
          <a href="${frontendUrl}/admin/instellingen" style="display:inline-block;padding:14px 28px;${btnBg}color:${brandColorText};border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
            Naar dashboard
          </a>
        </div>`;
      break;

    case 'payment_failed':
      subject = 'Betaling mislukt — actie vereist';
      content = `
        <h2 style="color:#DC2626;font-size:22px;margin:0 0 16px;">Betaling mislukt</h2>
        <p style="font-size:15px;color:#475569;line-height:1.6;">
          De maandelijkse betaling voor <strong>${esc(salon.name)}</strong> is helaas mislukt.
          Je account blijft nog <strong>7 dagen</strong> actief zodat je de betaalmethode kunt bijwerken.
        </p>
        <p style="font-size:15px;color:#475569;line-height:1.6;">
          Na 7 dagen wordt je account gepauzeerd en kunnen klanten geen nieuwe afspraken meer boeken.
          Neem contact met ons op als je vragen hebt.
        </p>
        <div style="margin:28px 0;text-align:center;">
          <a href="${frontendUrl}/admin/instellingen" style="display:inline-block;padding:14px 28px;background:#DC2626;color:#FFFFFF;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
            Betaling bijwerken
          </a>
        </div>`;
      break;

    case 'cancelled':
      subject = 'Je Bellure abonnement is opgezegd';
      content = `
        <h2 style="color:${brandColor};font-size:22px;margin:0 0 16px;">Abonnement opgezegd</h2>
        <p style="font-size:15px;color:#475569;line-height:1.6;">
          Je abonnement voor <strong>${esc(salon.name)}</strong> is opgezegd.
          Je account blijft toegankelijk tot het einde van de huidige betaalperiode.
        </p>
        <p style="font-size:15px;color:#475569;line-height:1.6;">
          Al je gegevens blijven bewaard. Je kunt op elk moment opnieuw een abonnement activeren
          via je dashboard.
        </p>
        <div style="margin:28px 0;text-align:center;">
          <a href="${frontendUrl}/admin/instellingen" style="display:inline-block;padding:14px 28px;${btnBg}color:${brandColorText};border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
            Naar dashboard
          </a>
        </div>`;
      break;

    case 'paused':
      subject = 'Je Bellure account is gepauzeerd';
      content = `
        <h2 style="color:#DC2626;font-size:22px;margin:0 0 16px;">Account gepauzeerd</h2>
        <p style="font-size:15px;color:#475569;line-height:1.6;">
          Je account voor <strong>${esc(salon.name)}</strong> is gepauzeerd omdat de betaling
          na meerdere pogingen niet is gelukt.
        </p>
        <p style="font-size:15px;color:#475569;line-height:1.6;">
          Klanten kunnen momenteel geen nieuwe afspraken boeken. Al je gegevens, instellingen
          en bestaande afspraken blijven bewaard. Activeer een nieuw abonnement om direct weer online te zijn.
        </p>
        <div style="margin:28px 0;text-align:center;">
          <a href="${frontendUrl}/admin/instellingen" style="display:inline-block;padding:14px 28px;${btnBg}color:${brandColorText};border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
            Abonnement heractiveren
          </a>
        </div>`;
      break;
  }

  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!--[if mso]><style>td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#F7F7F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F5;padding:24px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="${headerBg}padding:20px 24px;text-align:center;">${logoHtml}</td></tr>
        <tr><td style="padding:28px 24px 20px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E293B;">
            ${content}
            <p style="font-size:13px;color:#94A3B8;text-align:center;">
              Vragen? Antwoord op deze email of neem contact op via hello@bellure.nl
            </p>
          </div>
        </td></tr>
        <tr><td style="padding:16px 24px 20px;text-align:center;border-top:1px solid #F1F1EF;">
          ${footerLine}
          <p style="color:#CBD5E1;font-size:11px;margin:8px 0 0;">Powered by <a href="https://bellure.nl" style="color:#CBD5E1;text-decoration:underline;">Bellure</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Bellure <noreply@bellure.nl>',
        to: [ownerUser.email],
        reply_to: ['hello@bellure.nl'],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      console.error(`Subscription email (${type}) failed for ${salonId}:`, res.status, await res.text());
    }
  } catch (err) {
    console.error(`Subscription email (${type}) error for ${salonId}:`, err);
  }
}

// Export sendSubscriptionEmail for use by scheduled worker
export { sendSubscriptionEmail };
