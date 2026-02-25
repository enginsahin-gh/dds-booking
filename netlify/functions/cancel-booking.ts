import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const MOLLIE_API_BASE = 'https://api.mollie.com/v2';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CancelBody {
  bookingId: string;
  reason?: string;
  refund?: boolean; // default true — refund the deposit
}

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // TODO: Add admin auth check (Supabase JWT or API key)
  // For now, this is called from the admin dashboard

  try {
    const body: CancelBody = JSON.parse(event.body || '{}');
    const { bookingId, reason, refund = true } = body;

    if (!bookingId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing bookingId' }) };
    }

    // Get booking with payment info
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, status, payment_status, amount_paid_cents, salon_id, customer_email, customer_name')
      .eq('id', bookingId)
      .single();

    if (bookingErr || !booking) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
    }

    if (booking.status === 'cancelled') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Booking is already cancelled' }) };
    }

    // Cancel the booking
    const { error: cancelErr } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (cancelErr) {
      console.error('Failed to cancel booking:', cancelErr);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to cancel booking' }) };
    }

    let refundResult = null;

    // Refund if payment was made and refund is requested
    if (refund && booking.payment_status === 'paid' && booking.amount_paid_cents > 0) {
      const mollieApiKey = process.env.MOLLIE_API_KEY;

      if (mollieApiKey) {
        // Get the Mollie payment ID
        const { data: payment } = await supabase
          .from('payments')
          .select('id, mollie_payment_id, amount')
          .eq('booking_id', bookingId)
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (payment) {
          const refundAmountCents = booking.amount_paid_cents;
          const refundAmountStr = (refundAmountCents / 100).toFixed(2);

          try {
            // Create Mollie refund
            const mollieRes = await fetch(
              `${MOLLIE_API_BASE}/payments/${payment.mollie_payment_id}/refunds`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${mollieApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  amount: { currency: 'EUR', value: refundAmountStr },
                  description: reason || `Annulering boeking ${bookingId.slice(0, 8)}`,
                }),
              }
            );

            if (mollieRes.ok) {
              const mollieRefund = await mollieRes.json();

              // Store refund in database
              await supabase.from('refunds').insert({
                booking_id: bookingId,
                payment_id: payment.id,
                mollie_refund_id: mollieRefund.id,
                amount_cents: refundAmountCents,
                reason: reason || 'Annulering',
                status: 'processing',
              });

              // Update booking
              await supabase
                .from('bookings')
                .update({
                  refund_status: 'pending',
                  payment_status: 'refunded',
                })
                .eq('id', bookingId);

              // Update payment status
              await supabase
                .from('payments')
                .update({ status: 'refunded', updated_at: new Date().toISOString() })
                .eq('id', payment.id);

              refundResult = {
                mollieRefundId: mollieRefund.id,
                amount: refundAmountStr,
                status: 'processing',
              };

              console.log(`Refund created: ${mollieRefund.id} for booking ${bookingId}`);
            } else {
              const errBody = await mollieRes.text();
              console.error('Mollie refund failed:', mollieRes.status, errBody);

              await supabase
                .from('bookings')
                .update({ refund_status: 'failed' })
                .eq('id', bookingId);

              refundResult = { error: 'Refund failed at Mollie', status: 'failed' };
            }
          } catch (err) {
            console.error('Refund error:', err);
            refundResult = { error: 'Refund request failed', status: 'failed' };
          }
        }
      } else {
        refundResult = { error: 'No Mollie API key configured', status: 'skipped' };
      }
    }

    // Send cancellation email
    const emailSecret = process.env.EMAIL_SECRET;
    const siteUrl = process.env.URL || 'https://dds-booking-v2.netlify.app';

    try {
      await fetch(`${siteUrl}/.netlify/functions/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-email-secret': emailSecret || '',
        },
        body: JSON.stringify({
          type: 'cancellation',
          bookingId,
          salonId: booking.salon_id,
        }),
      });
    } catch (err) {
      console.error('Cancellation email error:', err);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        bookingId,
        refund: refundResult,
      }),
    };
  } catch (err) {
    console.error('Cancel booking error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};

export { handler };
