import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';

const MOLLIE_API_BASE = 'https://api.mollie.com/v2';

export async function cancelBooking(c: Context<{ Bindings: Env }>) {
  const supabase = getSupabase(c.env);
  const { bookingId, reason, refund = true } = await c.req.json();

  if (!bookingId) return c.json({ error: 'Missing bookingId' }, 400);

  const { data: booking } = await supabase.from('bookings')
    .select('id, status, payment_status, amount_paid_cents, salon_id, customer_email, customer_name')
    .eq('id', bookingId).single();

  if (!booking) return c.json({ error: 'Booking not found' }, 404);
  if (booking.status === 'cancelled') return c.json({ error: 'Already cancelled' }, 400);

  await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', bookingId);

  let refundResult = null;

  if (refund && booking.payment_status === 'paid' && booking.amount_paid_cents > 0) {
    const mollieApiKey = c.env.MOLLIE_API_KEY;
    if (mollieApiKey) {
      const { data: payment } = await supabase.from('payments')
        .select('id, mollie_payment_id, amount')
        .eq('booking_id', bookingId).eq('status', 'paid')
        .order('created_at', { ascending: false }).limit(1).single();

      if (payment) {
        const refundAmountStr = (booking.amount_paid_cents / 100).toFixed(2);
        try {
          const mollieRes = await fetch(`${MOLLIE_API_BASE}/payments/${payment.mollie_payment_id}/refunds`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${mollieApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: { currency: 'EUR', value: refundAmountStr }, description: reason || `Annulering ${bookingId.slice(0, 8)}` }),
          });

          if (mollieRes.ok) {
            const mollieRefund: any = await mollieRes.json();
            await supabase.from('refunds').insert({ booking_id: bookingId, payment_id: payment.id, mollie_refund_id: mollieRefund.id, amount_cents: booking.amount_paid_cents, reason: reason || 'Annulering', status: 'processing' });
            await supabase.from('bookings').update({ refund_status: 'pending', payment_status: 'refunded' }).eq('id', bookingId);
            await supabase.from('payments').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', payment.id);
            refundResult = { mollieRefundId: mollieRefund.id, amount: refundAmountStr, status: 'processing' };
          } else {
            await supabase.from('bookings').update({ refund_status: 'failed' }).eq('id', bookingId);
            refundResult = { error: 'Refund failed', status: 'failed' };
          }
        } catch { refundResult = { error: 'Refund request failed', status: 'failed' }; }
      }
    }
  }

  // Send cancellation email
  const siteUrl = c.env.SITE_URL || 'https://dds-booking-widget.netlify.app';
  c.executionCtx.waitUntil(
    fetch(`${siteUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-email-secret': c.env.EMAIL_SECRET || '' },
      body: JSON.stringify({ type: 'cancellation', bookingId, salonId: booking.salon_id }),
    }).catch(err => console.error('Cancel email error:', err))
  );

  return c.json({ success: true, bookingId, refund: refundResult });
}
