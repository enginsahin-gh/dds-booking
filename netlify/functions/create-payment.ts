import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface MolliePaymentResponse {
  id: string;
  status: string;
  amount: { currency: string; value: string };
  _links: {
    checkout?: { href: string };
    self: { href: string };
  };
}

interface CreatePaymentBody {
  bookingId: string;
  redirectUrl: string;
}

const MOLLIE_API_BASE = 'https://api.mollie.com/v2';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatMollieAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Calculate deposit amount based on salon settings.
 * This is the single source of truth — never trust client-side amounts.
 */
function calculateDepositCents(
  paymentMode: string,
  depositType: string,
  depositValue: number,
  totalCents: number
): number {
  if (paymentMode === 'none') return 0;
  if (paymentMode === 'full') return totalCents;

  // deposit mode
  if (depositType === 'percentage') {
    const pct = Math.min(Math.max(depositValue, 0), 100);
    return Math.round(totalCents * (pct / 100));
  }

  // fixed amount in euros
  const fixedCents = Math.round(depositValue * 100);
  return Math.min(fixedCents, totalCents);
}

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const mollieApiKey = process.env.MOLLIE_API_KEY;
  if (!mollieApiKey) {
    console.error('MOLLIE_API_KEY not configured');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment system not configured' }) };
  }

  try {
    const body: CreatePaymentBody = JSON.parse(event.body || '{}');
    const { bookingId, redirectUrl } = body;

    if (!bookingId || !redirectUrl) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields: bookingId, redirectUrl' }) };
    }

    // Get booking with service and salon
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, status, payment_status, salon_id, service_id, amount_total_cents')
      .eq('id', bookingId)
      .single();

    if (bookingErr || !booking) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
    }

    if (booking.payment_status === 'paid') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Booking is already paid' }) };
    }

    // Get salon payment settings
    const { data: salon } = await supabase
      .from('salons')
      .select('slug, name, payment_mode, deposit_type, deposit_value')
      .eq('id', booking.salon_id)
      .single();

    if (!salon || salon.payment_mode === 'none') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'This salon does not require online payment' }) };
    }

    // Get service for description
    const { data: service } = await supabase
      .from('services')
      .select('name, price_cents')
      .eq('id', booking.service_id)
      .single();

    const totalCents = booking.amount_total_cents || service?.price_cents || 0;

    // SERVER-SIDE calculation of deposit amount (single source of truth)
    const depositCents = calculateDepositCents(
      salon.payment_mode,
      salon.deposit_type,
      salon.deposit_value,
      totalCents
    );

    if (depositCents < 100) {
      // Mollie minimum is €1.00
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Amount too low for online payment' }) };
    }

    const isDeposit = salon.payment_mode === 'deposit';
    const description = isDeposit
      ? `Aanbetaling: ${service?.name || 'Behandeling'} bij ${salon.name}`
      : `${service?.name || 'Behandeling'} bij ${salon.name}`;

    const siteUrl = process.env.URL || 'https://dds-booking-v2.netlify.app';
    const webhookUrl = `${siteUrl}/.netlify/functions/mollie-webhook`;

    // Create Mollie payment
    const mollieRes = await fetch(`${MOLLIE_API_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mollieApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: { currency: 'EUR', value: formatMollieAmount(depositCents) },
        description,
        redirectUrl,
        webhookUrl,
        metadata: {
          booking_id: bookingId,
          salon_slug: salon.slug,
          payment_type: salon.payment_mode,
        },
      }),
    });

    if (!mollieRes.ok) {
      const errBody = await mollieRes.text();
      console.error('Mollie API error:', mollieRes.status, errBody);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to create payment' }) };
    }

    const molliePayment: MolliePaymentResponse = await mollieRes.json();

    // Store payment in Supabase
    await supabase.from('payments').insert({
      booking_id: bookingId,
      mollie_payment_id: molliePayment.id,
      amount: depositCents / 100,
      currency: 'EUR',
      status: 'open',
      description,
      metadata: {
        salon_slug: salon.slug,
        payment_type: salon.payment_mode,
        total_cents: totalCents,
        deposit_cents: depositCents,
      },
    });

    // Update booking payment tracking
    await supabase
      .from('bookings')
      .update({
        payment_status: 'pending',
        amount_due_cents: depositCents,
        deposit_amount: depositCents / 100,
      })
      .eq('id', bookingId);

    const checkoutUrl = molliePayment._links.checkout?.href;
    if (!checkoutUrl) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'No checkout URL returned' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        checkoutUrl,
        paymentId: molliePayment.id,
        depositCents,
        totalCents,
      }),
    };
  } catch (err) {
    console.error('Create payment error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};

export { handler };
