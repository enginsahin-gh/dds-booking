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
  const mollieApiKey = c.env.MOLLIE_API_KEY;
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

  const supabase = getSupabase(c.env);

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
        const siteUrl = c.env.SITE_URL || 'https://dds-booking-widget.netlify.app';
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
