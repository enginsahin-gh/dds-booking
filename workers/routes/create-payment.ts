import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { logError } from '../lib/logger';

const MOLLIE_API_BASE = 'https://api.mollie.com/v2';

function formatMollieAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function calculateDepositCents(paymentMode: string, depositType: string, depositValue: number, totalCents: number): number {
  if (paymentMode === 'none') return 0;
  if (paymentMode === 'full') return totalCents;
  if (depositType === 'percentage') return Math.round(totalCents * (Math.min(Math.max(depositValue, 0), 100) / 100));
  return Math.min(Math.round(depositValue * 100), totalCents);
}

export async function createPayment(c: Context<{ Bindings: Env }>) {
  const supabase = getSupabase(c.env);
  let { bookingId, redirectUrl } = await c.req.json();

  if (!bookingId || !redirectUrl) return c.json({ error: 'Missing required fields' }, 400);

  // SEC-011: Validate redirectUrl to prevent open redirect
  const allowedRedirectPrefixes = [
    'https://mijn.bellure.nl',
    'https://bellure.nl',
  ];
  const isAllowedRedirect = allowedRedirectPrefixes.some(p => redirectUrl.startsWith(p))
    || /^https:\/\/[a-z0-9-]+\.bellure\.nl/.test(redirectUrl)
    || /^https:\/\/[a-z0-9-]+\.netlify\.app/.test(redirectUrl);
  if (!isAllowedRedirect) {
    redirectUrl = `${c.env.FRONTEND_URL || 'https://mijn.bellure.nl'}/boeking/bevestiging`;
  }

  const { data: booking } = await supabase.from('bookings').select('id, status, payment_status, salon_id, service_id, amount_total_cents').eq('id', bookingId).single();
  if (!booking) return c.json({ error: 'Booking not found' }, 404);
  if (booking.payment_status === 'paid') return c.json({ error: 'Already paid' }, 400);

  const { data: salon } = await supabase.from('salons').select('slug, name, payment_mode, deposit_type, deposit_value, mollie_profile_id').eq('id', booking.salon_id).single();
  if (!salon || salon.payment_mode === 'none') return c.json({ error: 'No online payment required' }, 400);

  // Fetch Mollie tokens from salon_secrets (sensitive data, separate table)
  const { data: secrets } = await supabase.from('salon_secrets').select('mollie_access_token, mollie_refresh_token').eq('salon_id', booking.salon_id).single();

  // Determine Mollie auth: prefer salon's own token (Mollie Connect), fallback to platform key
  let mollieAuth: string;
  if (secrets?.mollie_access_token) {
    mollieAuth = `Bearer ${secrets.mollie_access_token}`;
  } else {
    const mollieApiKey = c.env.MOLLIE_API_KEY;
    if (!mollieApiKey) return c.json({ error: 'Payment system not configured' }, 500);
    mollieAuth = `Bearer ${mollieApiKey}`;
  }

  const { data: service } = await supabase.from('services').select('name, price_cents').eq('id', booking.service_id).single();
  const totalCents = booking.amount_total_cents || service?.price_cents || 0;
  const depositCents = calculateDepositCents(salon.payment_mode, salon.deposit_type, salon.deposit_value, totalCents);

  if (depositCents < 100) return c.json({ error: 'Amount too low' }, 400);

  const isDeposit = salon.payment_mode === 'deposit';
  const description = isDeposit ? `Aanbetaling: ${service?.name || 'Behandeling'} bij ${salon.name}` : `${service?.name || 'Behandeling'} bij ${salon.name}`;
  const siteUrl = c.env.SITE_URL || 'https://api.bellure.nl';

  // Build payment request body
  const paymentBody: Record<string, unknown> = {
    amount: { currency: 'EUR', value: formatMollieAmount(depositCents) },
    description,
    redirectUrl,
    webhookUrl: `${siteUrl}/api/mollie-webhook`,
    metadata: { booking_id: bookingId, salon_slug: salon.slug, payment_type: salon.payment_mode },
  };

  // If using salon's Mollie Connect token, include profile ID
  if (secrets?.mollie_access_token && salon.mollie_profile_id) {
    paymentBody.profileId = salon.mollie_profile_id;
  }

  let mollieRes = await fetch(`${MOLLIE_API_BASE}/payments`, {
    method: 'POST',
    headers: { 'Authorization': mollieAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentBody),
  });

  // If 401 and we have a refresh token, try refreshing
  if (mollieRes.status === 401 && secrets?.mollie_refresh_token) {
    const { refreshMollieToken } = await import('./mollie-connect');
    const newToken = await refreshMollieToken(c.env, booking.salon_id, secrets.mollie_refresh_token);
    if (newToken) {
      mollieAuth = `Bearer ${newToken}`;
      mollieRes = await fetch(`${MOLLIE_API_BASE}/payments`, {
        method: 'POST',
        headers: { 'Authorization': mollieAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentBody),
      });
    }
  }

  if (!mollieRes.ok) {
    logError(c, 'Mollie error', { status: mollieRes.status });
    return c.json({ error: 'Failed to create payment' }, 502);
  }

  const molliePayment: any = await mollieRes.json();

  await supabase.from('payments').insert({
    booking_id: bookingId, mollie_payment_id: molliePayment.id,
    amount: depositCents / 100, currency: 'EUR', status: 'open', description,
    metadata: { salon_slug: salon.slug, payment_type: salon.payment_mode, total_cents: totalCents, deposit_cents: depositCents },
  });

  await supabase.from('bookings').update({ payment_status: 'pending', amount_due_cents: depositCents, deposit_amount: depositCents / 100 }).eq('id', bookingId);

  const checkoutUrl = molliePayment._links?.checkout?.href;
  if (!checkoutUrl) return c.json({ error: 'No checkout URL' }, 502);

  return c.json({ checkoutUrl, paymentId: molliePayment.id, depositCents, totalCents });
}
