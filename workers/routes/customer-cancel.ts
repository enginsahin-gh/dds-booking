import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { deleteBookingFromGoogle } from '../lib/google-calendar';
import { notifyNextWaitlisted } from './waitlist';
import { logError } from '../lib/logger';

/**
 * Customer-facing cancellation via unique token.
 * No auth required — the token IS the auth.
 * GET /api/cancel?token=xxx → HTML confirmation page
 * POST /api/cancel { token } → execute cancellation
 */
export async function customerCancel(c: Context<{ Bindings: Env }>) {
  const supabase = getSupabase(c.env);

  if (c.req.method === 'GET') {
    const token = c.req.query('token');
    if (!token || token.length < 16) return c.html(cancelPage('Ongeldige link.', false));

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, customer_name, start_at, services:service_id(name), staff:staff_id(name), salons:salon_id(name)')
      .eq('cancel_token', token)
      .single();

    if (!booking) return c.html(cancelPage('Deze annuleringslink is ongeldig of al gebruikt.', false));
    if (booking.status === 'cancelled') return c.html(cancelPage('Deze afspraak is al geannuleerd.', false));

    const date = new Date(booking.start_at).toLocaleDateString('nl-NL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam'
    });
    const time = new Date(booking.start_at).toLocaleTimeString('nl-NL', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam'
    });
    const salonName = (booking as any).salons?.name || '';
    const serviceName = (booking as any).services?.name || '';

    return c.html(cancelPage('', true, {
      token,
      name: booking.customer_name,
      date,
      time,
      service: serviceName,
      salon: salonName,
    }));
  }

  // POST: execute cancellation
  const body = await c.req.json();
  const { token } = body;

  if (!token || token.length < 16) return c.json({ error: 'Invalid token' }, 400);

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, salon_id, service_id, staff_id, start_at')
    .eq('cancel_token', token)
    .single();

  if (!booking) return c.json({ error: 'Invalid or expired link' }, 404);
  if (booking.status === 'cancelled') return c.json({ error: 'Already cancelled' }, 400);

  // Cancel the booking
  await supabase.from('bookings').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancel_token: null, // Invalidate token after use
  }).eq('id', booking.id);

  // Delete Google Calendar event (non-blocking)
  c.executionCtx.waitUntil(deleteBookingFromGoogle(c.env, booking.id, booking.salon_id));

  // Send cancellation emails non-blocking (to customer + salon notification)
  const apiBase = c.env.SITE_URL || 'https://api.bellure.nl';
  const emailHeaders = { 'Content-Type': 'application/json', 'x-email-secret': c.env.EMAIL_SECRET || '' };
  c.executionCtx.waitUntil(
    Promise.allSettled([
      fetch(`${apiBase}/api/send-email`, {
        method: 'POST', headers: emailHeaders,
        body: JSON.stringify({ type: 'cancellation', bookingId: booking.id, salonId: booking.salon_id }),
      }),
      fetch(`${apiBase}/api/send-email`, {
        method: 'POST', headers: emailHeaders,
        body: JSON.stringify({ type: 'cancellation_notification', bookingId: booking.id, salonId: booking.salon_id }),
      }),
    ])
  );

  // Notify next waitlisted customer (non-blocking)
  if (booking.start_at && booking.service_id) {
    const cancelDate = booking.start_at.split('T')[0];
    c.executionCtx.waitUntil(
      notifyNextWaitlisted(c.env, booking.salon_id, cancelDate, booking.service_id, booking.staff_id)
        .catch(err => logError(c, 'Waitlist notify after customer cancel error', { message: err instanceof Error ? err.message : String(err) }))
    );
  }

  return c.json({ success: true });
}

function cancelPage(message: string, showForm: boolean, data?: any): string {
  const formHtml = showForm && data ? `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#666;">Afspraak van</p>
      <p style="margin:0 0 16px;font-size:18px;font-weight:600;">${esc(data.name)}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#666;">Salon</td><td style="font-weight:500;">${esc(data.salon)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Behandeling</td><td style="font-weight:500;">${esc(data.service)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Datum</td><td style="font-weight:500;">${esc(data.date)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Tijd</td><td style="font-weight:500;">${esc(data.time)}</td></tr>
      </table>
    </div>
    <button onclick="doCancel('${data.token}')" id="cancelBtn" style="width:100%;padding:14px;background:#EF4444;color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;">
      Afspraak annuleren
    </button>
    <p style="text-align:center;color:#999;font-size:13px;margin-top:12px;">Deze actie kan niet ongedaan worden gemaakt.</p>
    <div id="result" style="display:none;margin-top:16px;padding:16px;border-radius:12px;text-align:center;"></div>
    <script>
    async function doCancel(token) {
      const btn = document.getElementById('cancelBtn');
      const result = document.getElementById('result');
      btn.disabled = true;
      btn.textContent = 'Bezig...';
      try {
        const res = await fetch('/api/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        if (res.ok) {
          btn.style.display = 'none';
          result.style.display = 'block';
          result.style.background = '#F0FDF4';
          result.style.color = '#166534';
          result.innerHTML = '<strong>Je afspraak is geannuleerd.</strong><br>Je ontvangt een bevestiging per e-mail.';
        } else {
          const data = await res.json();
          btn.textContent = 'Afspraak annuleren';
          btn.disabled = false;
          result.style.display = 'block';
          result.style.background = '#FEF2F2';
          result.style.color = '#991B1B';
          result.textContent = data.error || 'Er ging iets mis.';
        }
      } catch {
        btn.textContent = 'Afspraak annuleren';
        btn.disabled = false;
      }
    }
    </script>` : `<p style="text-align:center;color:#666;">${message}</p>`;

  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Afspraak annuleren — Bellure</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAFAF8;margin:0;padding:20px;color:#1a1a1a;}
    .container{max-width:440px;margin:40px auto;}h1{font-size:22px;margin-bottom:24px;}</style></head>
    <body><div class="container"><h1>Afspraak annuleren</h1>${formHtml}</div></body></html>`;
}

function esc(s: string): string {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
