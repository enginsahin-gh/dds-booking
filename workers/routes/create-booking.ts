import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { syncBookingToGoogle } from '../lib/google-calendar';
import { rateLimit } from '../lib/rate-limit';
import { logError } from '../lib/logger';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface ServiceInput {
  id: string;
  priceCents: number;
  durationMin: number;
  name: string;
}

export async function createBooking(c: Context<{ Bindings: Env }>) {
  const supabase = getSupabase(c.env);
  const body = await c.req.json();
  const {
    salonId, staffId, startAt, endAt, name, email, phone, hp,
    // Multi-service: array of { id, priceCents, durationMin, name }
    services: servicesInput,
    // Legacy single-service (backward compat)
    serviceId,
    // Payment fields
    paymentMode, totalPriceCents, notes,
  } = body;

  const rate = await rateLimit(c, 'create-booking', 20, 60, salonId);
  if (!rate.ok) {
    const retryAfter = Math.max(0, rate.reset - Math.floor(Date.now() / 1000));
    c.header('Retry-After', String(retryAfter));
    return c.json({ error: 'RATE_LIMITED' }, 429);
  }

  // Determine services to book
  const services: ServiceInput[] = servicesInput && Array.isArray(servicesInput) && servicesInput.length > 0
    ? servicesInput
    : serviceId ? [{ id: serviceId, priceCents: 0, durationMin: 0, name: '' }] : [];

  if (!salonId || services.length === 0 || !staffId || !startAt || !endAt || !name || !email || !phone) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Email validation
  if (!EMAIL_REGEX.test(email)) {
    return c.json({ error: 'INVALID_EMAIL' }, 400);
  }

  // Honeypot
  if (hp) return c.json({ bookingId: 'ok' });

  // Fetch salon config (including subscription fields for trial/pause enforcement)
  const { data: salon } = await supabase
    .from('salons')
    .select('id, buffer_minutes, payment_mode, max_booking_weeks, subscription_status, trial_ends_at')
    .eq('id', salonId)
    .single();

  if (!salon) {
    return c.json({ error: 'Salon not found' }, 404);
  }

  // Block bookings for paused or cancelled salons
  if (salon.subscription_status === 'paused' || salon.subscription_status === 'cancelled') {
    return c.json({ error: 'SALON_PAUSED' }, 403);
  }

  // Block bookings for expired trials
  if (salon.subscription_status === 'trial' && salon.trial_ends_at) {
    if (new Date(salon.trial_ends_at) < new Date()) {
      return c.json({ error: 'SALON_PAUSED' }, 403);
    }
  }

  const bufferMin = salon.buffer_minutes || 0;
  const maxWeeks = salon.max_booking_weeks ?? 4;

  // Booking horizon validation
  if (maxWeeks > 0) {
    const maxDate = new Date(Date.now() + maxWeeks * 7 * 24 * 3600000);
    if (new Date(startAt) > maxDate) {
      return c.json({ error: 'BOOKING_TOO_FAR_AHEAD' }, 400);
    }
  }

  // Server-side service validation: verify services exist and belong to salon
  const serviceIds = services.map(s => s.id);
  const { data: dbServices } = await supabase
    .from('services')
    .select('id, price_cents, duration_min, name, is_active')
    .eq('salon_id', salonId)
    .in('id', serviceIds);

  if (!dbServices || dbServices.length !== serviceIds.length) {
    return c.json({ error: 'Invalid services' }, 400);
  }

  const inactiveService = dbServices.find(s => !s.is_active);
  if (inactiveService) {
    return c.json({ error: 'SERVICE_INACTIVE' }, 400);
  }

  // Calculate server-side totals (never trust client)
  const serverTotalCents = dbServices.reduce((sum, s) => sum + s.price_cents, 0);
  const serverTotalDuration = dbServices.reduce((sum, s) => sum + s.duration_min, 0);

  // Use the first service as the primary (for RPC compatibility)
  const primaryService = dbServices[0];
  const combinedServiceName = dbServices.map(s => s.name).join(' + ');

  // Server-side staff-service validation: verify staff can perform selected services
  const { data: staffMember } = await supabase
    .from('staff')
    .select('id, all_services')
    .eq('id', staffId)
    .single();

  if (!staffMember) {
    return c.json({ error: 'Staff not found' }, 404);
  }

  if (!staffMember.all_services) {
    const { data: staffServiceRecords } = await supabase
      .from('staff_services')
      .select('service_id')
      .eq('staff_id', staffId);

    const staffServiceIds = new Set((staffServiceRecords || []).map((ss: any) => ss.service_id));
    const invalidService = dbServices.find(s => !staffServiceIds.has(s.id));
    if (invalidService) {
      return c.json({ error: 'STAFF_CANNOT_PERFORM_SERVICE' }, 400);
    }
  }

  // Double-booking check with buffer (defense in depth, in addition to RPC)
  // Expand the check window by buffer_minutes on both sides
  const checkStart = bufferMin > 0
    ? new Date(new Date(startAt).getTime() - bufferMin * 60000).toISOString()
    : startAt;
  const checkEnd = bufferMin > 0
    ? new Date(new Date(endAt).getTime() + bufferMin * 60000).toISOString()
    : endAt;

  const { data: overlapping } = await supabase
    .from('bookings')
    .select('id')
    .eq('staff_id', staffId)
    .in('status', ['confirmed', 'pending_payment'])
    .lt('start_at', checkEnd)
    .gt('end_at', checkStart)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return c.json({ error: 'SLOT_TAKEN' }, 409);
  }

  // Create booking via RPC (atomic, with advisory lock + rate limiting)
  const { data: bookingId, error: bookingErr } = await supabase.rpc('create_booking', {
    p_salon_id: salonId,
    p_service_id: primaryService.id,
    p_staff_id: staffId,
    p_start_at: startAt,
    p_end_at: endAt,
    p_name: name,
    p_email: email,
    p_phone: phone,
    p_hp: hp || '',
  });

  if (bookingErr) {
    const msg = bookingErr.message || '';
    if (msg.includes('SLOT_TAKEN')) return c.json({ error: 'SLOT_TAKEN' }, 409);
    if (msg.includes('RATE_LIMITED')) return c.json({ error: 'RATE_LIMITED' }, 429);
    if (msg.includes('SPAM_DETECTED')) return c.json({ bookingId: 'ok' });
    if (msg.includes('INVALID_')) return c.json({ error: msg }, 400);
    logError(c, 'create_booking RPC error', { message: msg });
    return c.json({ error: 'Booking failed' }, 500);
  }

  if (!bookingId) {
    return c.json({ error: 'Booking failed' }, 500);
  }

  // Generate cancel token
  const cancelToken = crypto.randomUUID().replace(/-/g, '');

  // Determine payment status (use server-side salon config, not client input)
  const serverPaymentMode = salon.payment_mode || 'none';
  const needsPayment = serverPaymentMode !== 'none';
  const bookingStatus = needsPayment ? 'pending_payment' : 'confirmed';
  const paymentType = serverPaymentMode;

  // Update booking with payment fields, cancel token, notes
  await supabase.from('bookings').update({
    status: bookingStatus,
    cancel_token: cancelToken,
    payment_type: paymentType,
    payment_status: needsPayment ? 'pending' : 'none',
    amount_total_cents: serverTotalCents,
    amount_paid_cents: 0,
    amount_due_cents: needsPayment ? serverTotalCents : 0, // SEC-018: always use server-side calculated value
    notes: services.length > 1 ? combinedServiceName : null,
  }).eq('id', bookingId);

  // Insert booking_services records
  const bookingServices = dbServices.map((svc, idx) => ({
    booking_id: bookingId,
    service_id: svc.id,
    price_cents: svc.price_cents,
    duration_min: svc.duration_min,
    sort_order: idx,
  }));

  const { error: bsErr } = await supabase.from('booking_services').insert(bookingServices);
  if (bsErr) {
    logError(c, 'booking_services insert error', { message: bsErr.message });
    // Non-fatal: booking still created, just missing service breakdown
  }

  // Insert in-app notification (non-blocking)
  c.executionCtx.waitUntil(
    supabase.from('notifications').insert({
      salon_id: salonId,
      type: 'new_booking',
      title: `Nieuwe boeking: ${name}`,
      message: `${combinedServiceName} op ${new Date(startAt).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })} om ${new Date(startAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}`,
      booking_id: bookingId,
    }).then(({ error }) => { if (error) logError(c, 'Notification insert error', { message: error.message }); })
  );

  // Sync to Google Calendar (non-blocking) — only for confirmed bookings
  if (!needsPayment) {
    c.executionCtx.waitUntil(syncBookingToGoogle(c.env, bookingId, salonId));
  }

  // Send emails (non-blocking) — only for confirmed bookings (not pending_payment)
  if (!needsPayment) {
    const apiBase = c.env.SITE_URL || 'https://api.bellure.nl';
    const emailSecret = c.env.EMAIL_SECRET;

    const sendEmail = async (type: string) => {
      try {
        await fetch(`${apiBase}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-email-secret': emailSecret || '' },
          body: JSON.stringify({ type, bookingId, salonId }),
        });
      } catch (err) { logError(c, `Email ${type} error`, { message: err instanceof Error ? err.message : String(err) }); }
    };

    c.executionCtx.waitUntil(Promise.allSettled([sendEmail('confirmation'), sendEmail('notification')]));
  }

  return c.json({ bookingId, cancelToken });
}
