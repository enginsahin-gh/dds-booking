import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';

export async function paymentStatus(c: Context<{ Bindings: Env }>) {
  const bookingId = c.req.query('booking_id');
  if (!bookingId) return c.json({ error: 'Missing booking_id' }, 400);

  const supabase = getSupabase(c.env);

  // SEC-009: Only return minimal payment info — no customer data or service details
  const { data: payment } = await supabase.from('payments')
    .select('status, amount')
    .eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(1).single();

  if (!payment) return c.json({ error: 'No payment found' }, 404);

  const { data: booking } = await supabase.from('bookings')
    .select('payment_status')
    .eq('id', bookingId).single();

  return c.json({
    status: payment.status,
    amount: payment.amount,
    paymentStatus: booking?.payment_status || null,
  });
}
