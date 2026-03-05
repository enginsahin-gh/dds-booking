import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { verifyUser } from '../lib/auth';

export async function customerAppointments(c: Context<{ Bindings: Env }>) {
  const auth = await verifyUser(c);
  if (!auth || !auth.email) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase(c.env);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, salon_id, start_at, end_at, status, customer_name, customer_email, payment_status, amount_total_cents, cancel_token, staff:staff_id(name), salons:salon_id(name, slug, phone, address, postal_code, city, reschedule_enabled)')
    .eq('customer_email', auth.email)
    .order('start_at', { ascending: false });

  if (error) return c.json({ error: 'Failed to load appointments' }, 500);

  const bookingIds = (bookings || []).map((b: any) => b.id);

  let servicesByBooking: Record<string, string[]> = {};
  if (bookingIds.length > 0) {
    const { data: bs } = await supabase
      .from('booking_services')
      .select('booking_id, services(name)')
      .in('booking_id', bookingIds);

    if (bs) {
      for (const row of bs as any[]) {
        const id = row.booking_id as string;
        const name = row.services?.name as string | undefined;
        if (!servicesByBooking[id]) servicesByBooking[id] = [];
        if (name) servicesByBooking[id].push(name);
      }
    }
  }

  const result = (bookings || []).map((b: any) => ({
    id: b.id,
    salon: b.salons,
    staff: b.staff,
    start_at: b.start_at,
    end_at: b.end_at,
    status: b.status,
    payment_status: b.payment_status,
    amount_total_cents: b.amount_total_cents,
    cancel_token: b.cancel_token,
    services: servicesByBooking[b.id] || [],
  }));

  return c.json({ appointments: result });
}
