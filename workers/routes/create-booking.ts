import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';

// In-memory IP rate limiting (resets on worker eviction)
const ipRequests = new Map<string, { count: number; resetAt: number }>();
const IP_RATE_LIMIT = 10;
const IP_RATE_WINDOW_MS = 60 * 60 * 1000;

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + IP_RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > IP_RATE_LIMIT;
}

export async function createBooking(c: Context<{ Bindings: Env }>) {
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (isIpRateLimited(clientIp)) {
    return c.json({ error: 'RATE_LIMITED' }, 429);
  }

  const supabase = getSupabase(c.env);
  const body = await c.req.json();
  const { salonId, serviceId, staffId, startAt, endAt, name, email, phone, hp } = body;

  if (!salonId || !serviceId || !staffId || !startAt || !endAt || !name || !email || !phone) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Honeypot
  if (hp) return c.json({ bookingId: 'ok' });

  const { data: bookingId, error: bookingErr } = await supabase.rpc('create_booking', {
    p_salon_id: salonId, p_service_id: serviceId, p_staff_id: staffId,
    p_start_at: startAt, p_end_at: endAt, p_name: name, p_email: email, p_phone: phone, p_hp: hp || '',
  });

  if (bookingErr) {
    const msg = bookingErr.message || '';
    if (msg.includes('SLOT_TAKEN')) return c.json({ error: 'SLOT_TAKEN' }, 409);
    if (msg.includes('RATE_LIMITED')) return c.json({ error: 'RATE_LIMITED' }, 429);
    if (msg.includes('SPAM_DETECTED')) return c.json({ bookingId: 'ok' });
    if (msg.includes('INVALID_')) return c.json({ error: msg }, 400);
    return c.json({ error: 'Booking failed' }, 500);
  }

  // Fire emails non-blocking
  const siteUrl = c.env.SITE_URL || 'https://dds-booking-widget.netlify.app';
  const emailSecret = c.env.EMAIL_SECRET;

  const sendEmail = async (type: string) => {
    try {
      await fetch(`${siteUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-email-secret': emailSecret || '' },
        body: JSON.stringify({ type, bookingId, salonId }),
      });
    } catch (err) { console.error(`Email ${type} error:`, err); }
  };

  c.executionCtx.waitUntil(Promise.allSettled([sendEmail('confirmation'), sendEmail('notification')]));

  return c.json({ bookingId });
}
