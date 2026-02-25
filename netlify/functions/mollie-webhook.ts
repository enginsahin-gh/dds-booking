import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface MolliePaymentResponse {
  id: string;
  status: string;
  amount: { currency: string; value: string };
  method: string | null;
  metadata: Record<string, string>;
  paidAt?: string;
}

const MOLLIE_API_BASE = 'https://api.mollie.com/v2';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function mapMollieStatus(mollieStatus: string): string {
  switch (mollieStatus) {
    case 'paid': return 'paid';
    case 'failed': return 'failed';
    case 'expired': return 'expired';
    case 'canceled': return 'canceled';
    default: return 'open';
  }
}

function mapBookingPaymentStatus(mollieStatus: string): string {
  switch (mollieStatus) {
    case 'paid': return 'paid';
    case 'failed':
    case 'expired':
    case 'canceled': return 'failed';
    default: return 'pending';
  }
}

// Parse Mollie amount string to cents (e.g., "10.50" → 1050)
function parseMollieCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const mollieApiKey = process.env.MOLLIE_API_KEY;
  if (!mollieApiKey) {
    console.error('MOLLIE_API_KEY not configured');
    return { statusCode: 500, body: 'Not configured' };
  }

  try {
    // Parse webhook body — Mollie sends id as form-encoded
    let paymentId: string | null = null;

    if (event.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(event.body || '');
      paymentId = params.get('id');
    } else {
      try {
        const body = JSON.parse(event.body || '{}');
        paymentId = body.id;
      } catch { /* ignore */ }
    }

    if (!paymentId) {
      console.error('Webhook: no payment ID received');
      return { statusCode: 400, body: 'Missing payment ID' };
    }

    console.log(`Webhook received for payment: ${paymentId}`);

    // ALWAYS fetch actual status from Mollie (never trust webhook body)
    const mollieRes = await fetch(`${MOLLIE_API_BASE}/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mollieApiKey}` },
    });

    if (!mollieRes.ok) {
      console.error(`Mollie GET payment failed: ${mollieRes.status}`);
      return { statusCode: 502, body: 'Failed to verify payment' };
    }

    const molliePayment: MolliePaymentResponse = await mollieRes.json();
    const paymentStatus = mapMollieStatus(molliePayment.status);
    const bookingPaymentStatus = mapBookingPaymentStatus(molliePayment.status);
    const paidCents = parseMollieCents(molliePayment.amount.value);

    console.log(`Payment ${paymentId}: Mollie status=${molliePayment.status}, mapped=${paymentStatus}`);

    // Update payment record
    const updateData: Record<string, unknown> = {
      status: paymentStatus,
      method: molliePayment.method,
      updated_at: new Date().toISOString(),
    };

    if (molliePayment.status === 'paid' && molliePayment.paidAt) {
      updateData.paid_at = molliePayment.paidAt;
    }

    const { error: updateErr } = await supabase
      .from('payments')
      .update(updateData)
      .eq('mollie_payment_id', paymentId);

    if (updateErr) {
      console.error('Failed to update payment:', updateErr);
    }

    // Update booking
    const bookingId = molliePayment.metadata?.booking_id;
    if (bookingId) {
      const bookingUpdate: Record<string, unknown> = {
        payment_status: bookingPaymentStatus,
      };

      if (molliePayment.status === 'paid') {
        // Payment successful — confirm the booking
        bookingUpdate.status = 'confirmed';
        bookingUpdate.amount_paid_cents = paidCents;
        bookingUpdate.deposit_amount = paidCents / 100;
      } else if (['failed', 'expired', 'canceled'].includes(molliePayment.status)) {
        // Payment failed — cancel the booking (slot was reserved)
        bookingUpdate.status = 'cancelled';
        bookingUpdate.cancelled_at = new Date().toISOString();
      }

      const { error: bookingErr } = await supabase
        .from('bookings')
        .update(bookingUpdate)
        .eq('id', bookingId);

      if (bookingErr) {
        console.error('Failed to update booking:', bookingErr);
      }

      console.log(`Booking ${bookingId}: status updated, payment_status=${bookingPaymentStatus}`);

      // Send confirmation emails when payment is successful
      if (molliePayment.status === 'paid') {
        const emailSecret = process.env.EMAIL_SECRET;
        const siteUrl = process.env.URL || 'https://dds-booking-v2.netlify.app';

        // Get salon_id from booking
        const { data: booking } = await supabase
          .from('bookings')
          .select('salon_id')
          .eq('id', bookingId)
          .single();

        if (booking) {
          const sendEmail = async (type: string) => {
            try {
              const res = await fetch(`${siteUrl}/.netlify/functions/send-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-email-secret': emailSecret || '',
                },
                body: JSON.stringify({ type, bookingId, salonId: booking.salon_id }),
              });
              if (!res.ok) console.error(`Email ${type} failed:`, res.status);
            } catch (err) {
              console.error(`Email ${type} error:`, err);
            }
          };

          await Promise.allSettled([
            sendEmail('confirmation'),
            sendEmail('notification'),
          ]);
        }
      }
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 500, body: 'Internal error' };
  }
};

export { handler };
