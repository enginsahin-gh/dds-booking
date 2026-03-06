import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { verifyAuth } from '../lib/auth';
import { buildEmailPreview, createEmailLog, updateEmailLog } from '../lib/email-logs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_WAITLIST_PER_EMAIL = 3;

/**
 * POST /api/waitlist/join — public, no auth
 * Adds a customer to the waitlist for a specific salon/service/date.
 */
export async function waitlistJoin(c: Context<{ Bindings: Env }>) {
  const supabase = getSupabase(c.env);
  const body = await c.req.json();
  const {
    salonId, serviceId, staffId, name, email, phone,
    preferredDate, preferredTimeStart, preferredTimeEnd, hp,
  } = body;

  // Honeypot check
  if (hp) return c.json({ error: 'Invalid request' }, 400);

  // Required fields
  if (!salonId || !serviceId || !name || !email || !phone || !preferredDate) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Validate name
  if (name.trim().length < 2) {
    return c.json({ error: 'Name must be at least 2 characters' }, 400);
  }

  // Validate email
  if (!EMAIL_REGEX.test(email)) {
    return c.json({ error: 'Invalid email' }, 400);
  }

  // Validate date is in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prefDate = new Date(preferredDate + 'T00:00:00');
  if (isNaN(prefDate.getTime()) || prefDate < today) {
    return c.json({ error: 'Date must be in the future' }, 400);
  }

  // Rate limiting: max 3 waitlist entries per email per salon
  const { count } = await supabase
    .from('waitlist')
    .select('*', { count: 'exact', head: true })
    .eq('salon_id', salonId)
    .eq('customer_email', email.trim().toLowerCase())
    .in('status', ['waiting', 'notified']);

  if ((count || 0) >= MAX_WAITLIST_PER_EMAIL) {
    return c.json({ error: 'RATE_LIMITED' }, 429);
  }

  // Insert waitlist entry
  const { data, error } = await supabase.from('waitlist').insert({
    salon_id: salonId,
    service_id: serviceId,
    staff_id: staffId || null,
    customer_name: name.trim(),
    customer_email: email.trim().toLowerCase(),
    customer_phone: phone.trim(),
    preferred_date: preferredDate,
    preferred_time_start: preferredTimeStart || null,
    preferred_time_end: preferredTimeEnd || null,
    status: 'waiting',
  }).select('id').single();

  if (error) {
    console.error('Waitlist insert error:', error);
    return c.json({ error: 'Failed to join waitlist' }, 500);
  }

  return c.json({ waitlistId: data.id });
}

/**
 * POST /api/waitlist/notify — internal (x-email-secret) or admin (Bearer auth)
 * Notifies a waitlisted customer that a slot has become available.
 */
export async function waitlistNotify(c: Context<{ Bindings: Env }>) {
  const secret = c.req.header('x-email-secret');
  const hasSecret = secret && secret === c.env.EMAIL_SECRET;

  // Allow admin (owner) access via Bearer token as alternative
  if (!hasSecret) {
    const auth = await verifyAuth(c);
    if (!auth) return c.json({ error: 'Unauthorized' }, 401);
  }

  const supabase = getSupabase(c.env);
  const { waitlistId } = await c.req.json();

  if (!waitlistId) return c.json({ error: 'Missing waitlistId' }, 400);

  // Fetch waitlist entry
  const { data: entry } = await supabase
    .from('waitlist')
    .select('*, salons:salon_id(name, slug, email, brand_color, brand_color_text, brand_gradient_enabled, brand_gradient_from, brand_gradient_to, brand_gradient_direction, logo_url, email_footer_text), services:service_id(name)')
    .eq('id', waitlistId)
    .eq('status', 'waiting')
    .single();

  if (!entry) return c.json({ error: 'Waitlist entry not found or already notified' }, 404);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  // Update status to notified
  await supabase.from('waitlist').update({
    status: 'notified',
    notified_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  }).eq('id', waitlistId);

  // Send notification email
  const salon = entry.salons as any;
  const service = entry.services as any;
  const frontendUrl = c.env.FRONTEND_URL || 'https://mijn.bellure.nl';
  const bookingUrl = `${frontendUrl}?salon=${salon.slug}&date=${entry.preferred_date}`;

  const brandColor = salon.brand_color || '#8B5CF6';
  const brandColorText = salon.brand_color_text || '#FFFFFF';
  const gradientEnabled = salon.brand_gradient_enabled || false;
  const gradientFrom = salon.brand_gradient_from || brandColor;
  const gradientTo = salon.brand_gradient_to || '#6366F1';
  const gradientDir = salon.brand_gradient_direction || '135deg';

  const headerBg = gradientEnabled
    ? `background-color:${brandColor};background:linear-gradient(${gradientDir},${gradientFrom},${gradientTo});`
    : `background:${brandColor};`;
  const btnBg = headerBg;

  const logoHtml = salon.logo_url
    ? `<img src="${esc(salon.logo_url)}" alt="${esc(salon.name)}" style="max-height:48px;max-width:180px;display:block;margin:0 auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:${brandColorText};letter-spacing:-0.5px;">${esc(salon.name)}</span>`;

  const footerLine = salon.email_footer_text
    ? `<p style="color:#94A3B8;font-size:13px;margin:8px 0 0;font-style:italic;">${esc(salon.email_footer_text)}</p>`
    : '';

  const dateFormatted = new Date(entry.preferred_date + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const content = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E293B;">
      <div style="text-align:center;padding:16px 0;">
        <div style="display:inline-block;width:48px;height:48px;background:#F0FDF4;border-radius:50%;line-height:48px;text-align:center;">
          <span style="color:#16A34A;font-size:24px;">&#10003;</span>
        </div>
      </div>
      <h2 style="color:${brandColor};font-size:22px;margin:0 0 12px;text-align:center;">Er is een plek vrijgekomen</h2>
      <p style="font-size:15px;color:#475569;line-height:1.6;">Hoi ${esc(entry.customer_name)},</p>
      <p style="font-size:15px;color:#475569;line-height:1.6;">Voor <strong>${esc(service.name)}</strong> bij <strong>${esc(salon.name)}</strong> op <strong>${dateFormatted}</strong> is er een plek vrij.</p>
      <p style="font-size:14px;color:#64748B;line-height:1.6;">Je hebt 24 uur om te boeken. Daarna gaat de plek naar de volgende wachtende.</p>
      <div style="margin:24px 0;text-align:center;">
        <a href="${bookingUrl}" style="display:inline-block;padding:12px 24px;${btnBg}color:${brandColorText};border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;">
          Boek je afspraak
        </a>
      </div>
      <p style="font-size:12px;color:#94A3B8;text-align:center;">
        Link geldig tot ${expiresAt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })} om ${expiresAt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}.
      </p>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!--[if mso]><style>td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#F7F7F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F5;padding:24px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="${headerBg}padding:20px 24px;text-align:center;">${logoHtml}</td></tr>
        <tr><td style="padding:28px 24px 20px;">${content}</td></tr>
        <tr><td style="padding:16px 24px 20px;text-align:center;border-top:1px solid #F1F1EF;">
          ${footerLine}
          <p style="color:#CBD5E1;font-size:11px;margin:8px 0 0;">Powered by <a href="https://bellure.nl" style="color:#CBD5E1;text-decoration:underline;">Bellure</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const subject = `Plek vrijgekomen: ${service.name} bij ${salon.name}`;
  const preview = buildEmailPreview(html);

  const logId = await createEmailLog(supabase, {
    salon_id: entry.salon_id,
    waitlist_id: entry.id,
    type: 'waitlist',
    status: 'queued',
    provider: 'resend',
    to_email: entry.customer_email,
    customer_name: entry.customer_name,
    subject,
    body_preview: preview,
    body_html: html,
    meta: {
      preferred_date: entry.preferred_date,
      service_name: service.name,
      salon_name: salon.name,
    },
  });

  const resendKey = c.env.RESEND_API_KEY;
  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `${salon.name} <noreply@bellure.nl>`,
        to: [entry.customer_email],
        reply_to: [salon.email],
        subject,
        html,
      }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      console.error('Waitlist notification email error:', res.status, bodyText);
      if (logId) {
        await updateEmailLog(supabase, logId, {
          status: 'failed',
          error_message: bodyText || `Resend error ${res.status}`,
        });
      }
    } else if (logId) {
      let providerId: string | null = null;
      try {
        const json = bodyText ? JSON.parse(bodyText) : {};
        providerId = json?.id || null;
      } catch { /* ignore */ }
      await updateEmailLog(supabase, logId, {
        status: 'sent',
        provider_id: providerId,
        sent_at: new Date().toISOString(),
      });
    }
  }

  return c.json({ success: true });
}

/**
 * GET /api/waitlist/entries?salon_id=xxx — auth required (owner)
 * Returns all active waitlist entries for a salon.
 */
export async function waitlistEntries(c: Context<{ Bindings: Env }>) {
  const auth = await verifyAuth(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  const salonId = c.req.query('salon_id') || auth.salonId;
  if (salonId !== auth.salonId) return c.json({ error: 'Forbidden' }, 403);

  const supabase = getSupabase(c.env);
  const statusFilter = c.req.query('status');

  let query = supabase
    .from('waitlist')
    .select('*, services:service_id(name), staff:staff_id(name)')
    .eq('salon_id', salonId)
    .order('preferred_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  } else {
    // Default: show active entries
    query = query.in('status', ['waiting', 'notified']);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Waitlist entries query error:', error);
    return c.json({ error: 'Failed to fetch waitlist' }, 500);
  }

  return c.json({ entries: data || [] });
}

/**
 * POST /api/waitlist/cancel — public, with waitlist_id + email combo
 * Cancels a waitlist entry.
 */
export async function waitlistCancel(c: Context<{ Bindings: Env }>) {
  const supabase = getSupabase(c.env);
  const { waitlistId, email } = await c.req.json();

  if (!waitlistId || !email) {
    return c.json({ error: 'Missing waitlistId or email' }, 400);
  }

  const { data: entry } = await supabase
    .from('waitlist')
    .select('id, status')
    .eq('id', waitlistId)
    .eq('customer_email', email.trim().toLowerCase())
    .single();

  if (!entry) return c.json({ error: 'Entry not found' }, 404);
  if (entry.status === 'cancelled') return c.json({ error: 'Already cancelled' }, 400);

  await supabase.from('waitlist').update({ status: 'cancelled' }).eq('id', entry.id);

  return c.json({ success: true });
}

/**
 * Helper: notify the next waitlisted customer after a cancellation.
 * Called non-blocking via waitUntil() from cancel-booking and customer-cancel.
 */
export async function notifyNextWaitlisted(
  env: Env,
  salonId: string,
  date: string, // ISO date string (YYYY-MM-DD)
  serviceId: string,
  staffId?: string | null,
): Promise<void> {
  const supabase = getSupabase(env);

  // Find the first waiting entry that matches the cancelled booking's criteria
  let query = supabase
    .from('waitlist')
    .select('id')
    .eq('salon_id', salonId)
    .eq('status', 'waiting')
    .eq('preferred_date', date)
    .order('created_at', { ascending: true })
    .limit(1);

  // Optionally filter by service
  query = query.eq('service_id', serviceId);

  // Try with staff match first, fallback to any staff
  if (staffId) {
    const { data: staffMatch } = await query.eq('staff_id', staffId);
    if (staffMatch && staffMatch.length > 0) {
      await triggerNotify(env, staffMatch[0].id);
      return;
    }
    // Also check entries with no staff preference
    const { data: noStaffPref } = await supabase
      .from('waitlist')
      .select('id')
      .eq('salon_id', salonId)
      .eq('status', 'waiting')
      .eq('preferred_date', date)
      .eq('service_id', serviceId)
      .is('staff_id', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (noStaffPref && noStaffPref.length > 0) {
      await triggerNotify(env, noStaffPref[0].id);
      return;
    }
  } else {
    const { data } = await query;
    if (data && data.length > 0) {
      await triggerNotify(env, data[0].id);
      return;
    }
  }
}

async function triggerNotify(env: Env, waitlistId: string): Promise<void> {
  const apiBase = env.SITE_URL || 'https://api.bellure.nl';
  await fetch(`${apiBase}/api/waitlist/notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-email-secret': env.EMAIL_SECRET || '',
    },
    body: JSON.stringify({ waitlistId }),
  }).catch(err => console.error('Waitlist notify trigger error:', err));
}

/**
 * Handle expired waitlist notifications.
 * Entries with status 'notified' whose expires_at has passed → status 'expired'.
 * Then notify the next waiting customer if available.
 */
export async function handleExpiredWaitlist(env: Env): Promise<void> {
  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  // Find expired notifications
  const { data: expired, error } = await supabase
    .from('waitlist')
    .select('id, salon_id, service_id, staff_id, preferred_date')
    .eq('status', 'notified')
    .lt('expires_at', now);

  if (error) {
    console.error('Waitlist expiry check error:', error);
    return;
  }

  if (!expired || expired.length === 0) return;

  // Mark all as expired
  const expiredIds = expired.map(e => e.id);
  await supabase.from('waitlist').update({ status: 'expired' }).in('id', expiredIds);

  console.log(`Waitlist: expired ${expired.length} notification(s)`);

  // For each expired entry, try to notify the next person in line
  for (const entry of expired) {
    await notifyNextWaitlisted(
      env,
      entry.salon_id,
      entry.preferred_date,
      entry.service_id,
      entry.staff_id,
    );
  }
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
