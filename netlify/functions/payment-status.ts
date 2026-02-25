import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const bookingId = event.queryStringParameters?.booking_id;
  if (!bookingId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing booking_id parameter' }) };
  }

  try {
    // Get the latest payment for this booking
    const { data: payment, error: paymentErr } = await supabase
      .from('payments')
      .select('status, amount, currency, method, mollie_payment_id, paid_at, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (paymentErr || !payment) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No payment found for this booking' }) };
    }

    // Also get booking details for the confirmation page
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        id, start_at, end_at, customer_name, payment_status,
        services:service_id (name, price_cents, duration_min),
        staff:staff_id (name)
      `)
      .eq('id', bookingId)
      .single();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        payment: {
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          paidAt: payment.paid_at,
        },
        booking: booking || null,
      }),
    };
  } catch (err) {
    console.error('Payment status error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};

export { handler };
