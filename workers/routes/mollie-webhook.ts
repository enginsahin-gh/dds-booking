import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';

const MOLLIE_API_BASE = 'https://api.mollie.com/v2';

function mapBookingPaymentStatus(s: string): string {
  if (s === 'paid') return 'paid';
  if (['failed', 'expired', 'canceled'].includes(s)) return 'failed';
  return 'pending';
}

function mapPaymentStatus(s: string): string {
  if (s === 'paid') return 'paid';
  if (s === 'failed') return 'failed';
  if (s === 'expired') return 'expired';
  if (s === 'canceled') return 'canceled';
  return 'open';
}

function parseMollieCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

export async function mollieWebhook(c: Context<{ Bindings: Env }>) {
  // Default to platform key, will try salon-specific token later
  let mollieApiKey = c.env.MOLLIE_API_KEY;
  if (!mollieApiKey) return c.text('Not configured', 500);

  // Mollie sends form-encoded OR JSON
  let paymentId: string | null = null;
  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await c.req.parseBody();
    paymentId = formData.id as string;
  } else {
    try {
      const body = await c.req.json();
      paymentId = body.id;
    } catch { /* ignore */ }
  }

  if (!paymentId) return c.text('Missing payment ID', 400);

  // Validate payment ID format (Mollie IDs always start with "tr_")
  if (!paymentId.startsWith('tr_') || paymentId.length < 5 || paymentId.length > 40) {
    return c.text('Invalid payment ID', 400);
  }

  // Verify payment exists in our database before calling Mollie API
  const { data: existingPayment } = await getSupabase(c.env)
    .from('payments')
    .select('id')
    .eq('mollie_payment_id', paymentId)
    .limit(1);

  if (!existingPayment || existingPayment.length === 0) {
    return c.text('Unknown payment', 400);
  }

  const supabase = getSupabase(c.env);

  // Check if the payment's salon has its own Mollie token
  const { data: paymentRecord } = await supabase
    .from('payments')
    .select('booking_id')
    .eq('mollie_payment_id', paymentId)
    .single();

  if (paymentRecord?.booking_id) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('salon_id')
      .eq('id', paymentRecord.booking_id)
      .single();

    if (booking?.salon_id) {
      const { data: secrets } = await supabase
        .from('salon_secrets')
        .select('mollie_access_token')
        .eq('salon_id', booking.salon_id)
        .single();

      if (secrets?.mollie_access_token) {
        mollieApiKey = secrets.mollie_access_token;
      }
    }
  }

  // Always fetch actual status from Mollie
  const mollieRes = await fetch(`${MOLLIE_API_BASE}/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${mollieApiKey}` },
  });

  if (!mollieRes.ok) return c.text('Failed to verify payment', 502);

  const mp: any = await mollieRes.json();
  const paymentStatus = mapPaymentStatus(mp.status);
  const paidCents = parseMollieCents(mp.amount.value);

  // Update payment record
  const updateData: Record<string, unknown> = { status: paymentStatus, method: mp.method, updated_at: new Date().toISOString() };
  if (mp.status === 'paid' && mp.paidAt) updateData.paid_at = mp.paidAt;
  await supabase.from('payments').update(updateData).eq('mollie_payment_id', paymentId);

  // Update booking
  const bookingId = mp.metadata?.booking_id;
  if (bookingId) {
    const bookingUpdate: Record<string, unknown> = { payment_status: mapBookingPaymentStatus(mp.status) };

    if (mp.status === 'paid') {
      bookingUpdate.status = 'confirmed';
      bookingUpdate.amount_paid_cents = paidCents;
      bookingUpdate.deposit_amount = paidCents / 100;
    } else if (['failed', 'expired', 'canceled'].includes(mp.status)) {
      bookingUpdate.status = 'cancelled';
      bookingUpdate.cancelled_at = new Date().toISOString();
    }

    await supabase.from('bookings').update(bookingUpdate).eq('id', bookingId);

    // Send emails on success
    if (mp.status === 'paid') {
      const { data: booking } = await supabase.from('bookings').select('salon_id').eq('id', bookingId).single();
      if (booking) {
        const siteUrl = c.env.SITE_URL || 'https://api.bellure.nl';
        const sendEmail = async (type: string) => {
          try {
            await fetch(`${siteUrl}/api/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-email-secret': c.env.EMAIL_SECRET || '' },
              body: JSON.stringify({ type, bookingId, salonId: booking.salon_id }),
            });
          } catch (err) { console.error(`Email ${type} error:`, err); }
        };
        c.executionCtx.waitUntil(Promise.allSettled([sendEmail('confirmation'), sendEmail('notification')]));
      }
    }
  }

  return c.text('OK');
}
