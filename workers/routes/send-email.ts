import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Amsterdam' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function confirmationHtml(d: any): string {
  const paymentRows = d.paymentType === 'deposit' && d.depositPaid
    ? `<tr><td style="padding:8px 0;color:#666;">Aanbetaald</td><td style="padding:8px 0;"><strong style="color:#059669;">${d.depositPaid}</strong></td></tr>
       <tr><td style="padding:8px 0;color:#666;">Restbedrag in salon</td><td style="padding:8px 0;"><strong>${d.remainingAmount}</strong></td></tr>`
    : d.paymentType === 'full' && d.depositPaid
    ? `<tr><td style="padding:8px 0;color:#666;">Betaald</td><td style="padding:8px 0;"><strong style="color:#059669;">${d.depositPaid}</strong></td></tr>`
    : '';

  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
    <h2 style="color:#8B5CF6;">Afspraak bevestigd</h2>
    <p>Beste ${d.customerName},</p><p>Je afspraak is bevestigd:</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#666;">Dienst</td><td><strong>${d.serviceName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Bij</td><td><strong>${d.staffName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Datum</td><td><strong>${d.date}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Tijd</td><td><strong>${d.startTime} - ${d.endTime}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Prijs</td><td><strong>${d.price}</strong></td></tr>
      ${paymentRows}
    </table>
    ${d.paymentType === 'deposit' ? `<p style="margin-top:16px;padding:12px;background:#F0FDF4;border-radius:8px;color:#166534;font-size:14px;">Het restbedrag van ${d.remainingAmount} betaal je bij je bezoek aan de salon.</p>` : ''}
    <p style="margin-top:24px;color:#666;font-size:14px;">Wil je annuleren? Neem contact op met ${d.salonName} via ${d.salonEmail}.</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
    <p style="color:#999;font-size:12px;">${d.salonName} · Powered by De Digitale Stylist</p>
  </div>`;
}

function notificationHtml(d: any): string {
  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
    <h2>Nieuwe boeking</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#666;">Klant</td><td><strong>${d.customerName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Telefoon</td><td><strong>${d.customerPhone}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Email</td><td><strong>${d.customerEmail}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Dienst</td><td><strong>${d.serviceName} (${d.duration} min)</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Medewerker</td><td><strong>${d.staffName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Datum/Tijd</td><td><strong>${d.date}, ${d.startTime} - ${d.endTime}</strong></td></tr>
    </table>
    <p style="margin-top:16px;"><a href="${d.adminUrl}" style="color:#8B5CF6;">Bekijk in dashboard</a></p>
  </div>`;
}

function cancellationHtml(d: any): string {
  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
    <h2 style="color:#EF4444;">Afspraak geannuleerd</h2>
    <p>Beste ${d.customerName},</p>
    <p>Je afspraak op <strong>${d.date}</strong> om <strong>${d.startTime}</strong> voor <strong>${d.serviceName}</strong> is geannuleerd.</p>
    <p>Neem contact op met ${d.salonName} als je vragen hebt.</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
    <p style="color:#999;font-size:12px;">${d.salonName} · Powered by De Digitale Stylist</p>
  </div>`;
}

/**
 * Send email via SMTP using a simple fetch to an external relay.
 * Since Workers don't support raw TCP (nodemailer), we use MailChannels Send API
 * which is free for Cloudflare Workers (no API key needed, uses CF worker verification).
 */
async function sendMailChannels(from: string, fromName: string, to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: fromName },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!res.ok) {
    console.error('MailChannels error:', res.status, await res.text());
    return false;
  }
  return true;
}

export async function sendEmail(c: Context<{ Bindings: Env }>) {
  const secret = c.req.header('x-email-secret');
  if (!secret || secret !== c.env.EMAIL_SECRET) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase(c.env);
  const { type, bookingId, salonId } = await c.req.json();
  if (!type || !bookingId || !salonId) return c.json({ error: 'Missing fields' }, 400);

  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return c.json({ error: 'Booking not found' }, 404);

  const [salonRes, serviceRes, staffRes] = await Promise.all([
    supabase.from('salons').select('*').eq('id', salonId).single(),
    supabase.from('services').select('*').eq('id', booking.service_id).single(),
    supabase.from('staff').select('*').eq('id', booking.staff_id).single(),
  ]);

  const salon = salonRes.data!, service = serviceRes.data!, staff = staffRes.data!;
  const date = formatDate(booking.start_at);
  const startTime = formatTime(booking.start_at);
  const endTime = formatTime(booking.end_at);
  const smtpUser = c.env.SMTP_USER || 'boekingen@ensalabs.nl';

  let subject = '', to = '', html = '';

  if (type === 'confirmation') {
    subject = `Bevestiging: ${service.name} bij ${salon.name}`;
    to = booking.customer_email;
    const paidCents = booking.amount_paid_cents || 0;
    const remainingCents = service.price_cents - paidCents;
    html = confirmationHtml({
      customerName: esc(booking.customer_name), serviceName: esc(service.name), staffName: esc(staff.name),
      date, startTime, endTime, price: formatPrice(service.price_cents),
      salonName: esc(salon.name), salonEmail: esc(salon.email),
      depositPaid: paidCents > 0 ? formatPrice(paidCents) : undefined,
      remainingAmount: remainingCents > 0 ? formatPrice(remainingCents) : undefined,
      paymentType: booking.payment_type || 'none',
    });
  } else if (type === 'notification') {
    subject = `Nieuwe boeking: ${booking.customer_name} — ${service.name}`;
    to = salon.email;
    html = notificationHtml({
      customerName: esc(booking.customer_name), customerPhone: esc(booking.customer_phone),
      customerEmail: esc(booking.customer_email), serviceName: esc(service.name),
      duration: service.duration_min, staffName: esc(staff.name), date, startTime, endTime,
      adminUrl: `${c.env.SITE_URL || 'https://dds-booking-widget.netlify.app'}/admin/bookings`,
    });
  } else if (type === 'cancellation') {
    subject = `Afspraak geannuleerd: ${date} ${startTime}`;
    to = booking.customer_email;
    html = cancellationHtml({
      customerName: esc(booking.customer_name), serviceName: esc(service.name),
      date, startTime, salonName: esc(salon.name), salonEmail: esc(salon.email),
    });
  } else {
    return c.json({ error: 'Invalid email type' }, 400);
  }

  const fromName = type === 'notification' ? 'Boekingssysteem' : salon.name;
  const success = await sendMailChannels(smtpUser, fromName, to, subject, html);

  return c.json({ success });
}
