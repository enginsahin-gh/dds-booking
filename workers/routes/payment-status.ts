import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';

export async function paymentStatus(c: Context<{ Bindings: Env }>) {
  const bookingId = c.req.query('booking_id');
  if (!bookingId) return c.json({ error: 'Missing booking_id' }, 400);

  const supabase = getSupabase(c.env);

  const { data: payment } = await supabase.from('payments')
    .select('status, amount, currency, method, mollie_payment_id, paid_at, created_at')
    .eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(1).single();

  if (!payment) return c.json({ error: 'No payment found' }, 404);

  const { data: booking } = await supabase.from('bookings')
    .select('id, start_at, end_at, customer_name, payment_status, services:service_id (name, price_cents, duration_min), staff:staff_id (name)')
    .eq('id', bookingId).single();

  return c.json({
    payment: { status: payment.status, amount: payment.amount, currency: payment.currency, method: payment.method, paidAt: payment.paid_at },
    booking: booking || null,
  });
}
