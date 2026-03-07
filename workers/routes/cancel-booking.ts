import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { verifyAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';
import { deleteBookingFromGoogle } from '../lib/google-calendar';
import { notifyNextWaitlisted } from './waitlist';
import { logError } from '../lib/logger';

const MOLLIE_API_BASE = 'https://api.mollie.com/v2';

export async function cancelBooking(c: Context<{ Bindings: Env }>) {
  // SEC-003: Require owner authentication
  const owner = await verifyAuth(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase(c.env);
  const { bookingId, reason, refund = true } = await c.req.json();

  if (!bookingId) return c.json({ error: 'Missing bookingId' }, 400);

  const { data: booking } = await supabase.from('bookings')
    .select('id, status, payment_status, amount_paid_cents, salon_id, customer_email, customer_name, service_id, staff_id, start_at')
    .eq('id', bookingId).single();

  if (!booking) return c.json({ error: 'Booking not found' }, 404);

  // Verify the booking belongs to the owner's salon
  if (booking.salon_id !== owner.salonId) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  if (booking.status === 'cancelled') return c.json({ error: 'Already cancelled' }, 400);

  await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', bookingId);

  // Delete Google Calendar event (non-blocking)
  c.executionCtx.waitUntil(deleteBookingFromGoogle(c.env, bookingId, booking.salon_id));

  // Insert in-app notification
  c.executionCtx.waitUntil(
    supabase.from('notifications').insert({
      salon_id: booking.salon_id,
      type: 'cancellation',
      title: `Annulering: ${booking.customer_name}`,
      message: reason || 'Afspraak geannuleerd',
      booking_id: bookingId,
    }).then(({ error }) => { if (error) logError(c, 'Notification insert error', { message: error.message }); })
  );

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
  const siteUrl = c.env.SITE_URL || 'https://api.bellure.nl';
  c.executionCtx.waitUntil(
    fetch(`${siteUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-email-secret': c.env.EMAIL_SECRET || '' },
      body: JSON.stringify({ type: 'cancellation', bookingId, salonId: booking.salon_id }),
    }).catch(err => logError(c, 'Cancel email error', { message: err instanceof Error ? err.message : String(err) }))
  );

  // Notify next waitlisted customer (non-blocking)
  if (booking.start_at && booking.service_id) {
    const cancelDate = booking.start_at.split('T')[0];
    c.executionCtx.waitUntil(
      notifyNextWaitlisted(c.env, booking.salon_id, cancelDate, booking.service_id, booking.staff_id)
        .catch(err => logError(c, 'Waitlist notify after cancel error', { message: err instanceof Error ? err.message : String(err) }))
    );
  }

  // Audit log: booking cancellation (non-blocking)
  c.executionCtx.waitUntil(
    logAudit(c.env, {
      salonId: owner.salonId,
      action: 'booking.cancel',
      actorType: 'user',
      actorId: owner.userId,
      targetType: 'booking',
      targetId: bookingId,
      details: { reason, refund, customerName: booking.customer_name },
      ip: c.req.header('cf-connecting-ip') || undefined,
    })
  );

  return c.json({ success: true, bookingId, refund: refundResult });
}
