import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.ensalabs.nl',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('nl-NL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Europe/Amsterdam',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam',
  });
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/** Escape HTML entities to prevent XSS/HTML injection in emails (SEC-005) */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Email templates
function confirmationTemplate(data: {
  customerName: string; serviceName: string; staffName: string;
  date: string; startTime: string; endTime: string; price: string;
  salonName: string; salonEmail: string;
  depositPaid?: string; remainingAmount?: string; paymentType?: string;
}): string {
  const paymentRows = data.paymentType === 'deposit' && data.depositPaid
    ? `<tr><td style="padding:8px 0;color:#666;">Aanbetaald</td><td style="padding:8px 0;"><strong style="color:#059669;">${data.depositPaid}</strong></td></tr>
       <tr><td style="padding:8px 0;color:#666;">Restbedrag in salon</td><td style="padding:8px 0;"><strong>${data.remainingAmount}</strong></td></tr>`
    : data.paymentType === 'full' && data.depositPaid
    ? `<tr><td style="padding:8px 0;color:#666;">Betaald</td><td style="padding:8px 0;"><strong style="color:#059669;">${data.depositPaid}</strong></td></tr>`
    : '';

  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
    <h2 style="color:#8B5CF6;">Afspraak bevestigd</h2>
    <p>Beste ${data.customerName},</p>
    <p>Je afspraak is bevestigd:</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#666;">Dienst</td><td style="padding:8px 0;"><strong>${data.serviceName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Bij</td><td style="padding:8px 0;"><strong>${data.staffName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Datum</td><td style="padding:8px 0;"><strong>${data.date}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Tijd</td><td style="padding:8px 0;"><strong>${data.startTime} - ${data.endTime}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Prijs</td><td style="padding:8px 0;"><strong>${data.price}</strong></td></tr>
      ${paymentRows}
    </table>
    ${data.paymentType === 'deposit' ? `<p style="margin-top:16px;padding:12px;background:#F0FDF4;border-radius:8px;color:#166534;font-size:14px;">Het restbedrag van ${data.remainingAmount} betaal je bij je bezoek aan de salon.</p>` : ''}
    <p style="margin-top:24px;color:#666;font-size:14px;">Wil je annuleren? Neem contact op met ${data.salonName} via ${data.salonEmail}.</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
    <p style="color:#999;font-size:12px;">${data.salonName} · Powered by De Digitale Stylist</p>
  </div>`;
}

function notificationTemplate(data: {
  customerName: string; customerPhone: string; customerEmail: string;
  serviceName: string; duration: number; staffName: string;
  date: string; startTime: string; endTime: string;
}): string {
  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
    <h2>Nieuwe boeking 📅</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#666;">Klant</td><td><strong>${data.customerName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Telefoon</td><td><strong>${data.customerPhone}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Email</td><td><strong>${data.customerEmail}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Dienst</td><td><strong>${data.serviceName} (${data.duration} min)</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Medewerker</td><td><strong>${data.staffName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Datum/Tijd</td><td><strong>${data.date}, ${data.startTime} - ${data.endTime}</strong></td></tr>
    </table>
    <p style="margin-top:16px;"><a href="https://boeken.ensalabs.nl/admin/bookings" style="color:#8B5CF6;">Bekijk in dashboard →</a></p>
  </div>`;
}

function cancellationTemplate(data: {
  customerName: string; serviceName: string; date: string;
  startTime: string; salonName: string; salonEmail: string;
}): string {
  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
    <h2 style="color:#EF4444;">Afspraak geannuleerd</h2>
    <p>Beste ${data.customerName},</p>
    <p>Helaas is je afspraak op <strong>${data.date}</strong> om <strong>${data.startTime}</strong> voor <strong>${data.serviceName}</strong> geannuleerd.</p>
    <p>Neem contact op met ${data.salonName} als je vragen hebt of een nieuwe afspraak wilt maken.</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
    <p style="color:#999;font-size:12px;">${data.salonName} · Powered by De Digitale Stylist</p>
  </div>`;
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Enforce shared secret (SEC-007: reject unauthorized requests)
  const secret = event.headers['x-email-secret'] || event.headers['X-Email-Secret'];
  if (!secret || secret !== process.env.EMAIL_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { type, bookingId, salonId } = JSON.parse(event.body || '{}');
    if (!type || !bookingId || !salonId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Fetch booking with related data
    const { data: booking } = await supabase
      .from('bookings').select('*').eq('id', bookingId).single();
    if (!booking) return { statusCode: 404, body: JSON.stringify({ error: 'Booking not found' }) };

    const [salonRes, serviceRes, staffRes] = await Promise.all([
      supabase.from('salons').select('*').eq('id', salonId).single(),
      supabase.from('services').select('*').eq('id', booking.service_id).single(),
      supabase.from('staff').select('*').eq('id', booking.staff_id).single(),
    ]);

    const salon = salonRes.data!;
    const service = serviceRes.data!;
    const staff = staffRes.data!;

    const date = formatDate(booking.start_at);
    const startTime = formatTime(booking.start_at);
    const endTime = formatTime(booking.end_at);

    let subject = '';
    let to = '';
    let html = '';

    if (type === 'confirmation') {
      subject = `Bevestiging: ${service.name} bij ${salon.name}`;
      to = booking.customer_email;

      // Payment info for email
      const paidCents = booking.amount_paid_cents || 0;
      const paymentType = booking.payment_type || 'none';
      const remainingCents = service.price_cents - paidCents;

      html = confirmationTemplate({
        customerName: escapeHtml(booking.customer_name), serviceName: escapeHtml(service.name),
        staffName: escapeHtml(staff.name), date, startTime, endTime,
        price: formatPrice(service.price_cents), salonName: escapeHtml(salon.name), salonEmail: escapeHtml(salon.email),
        depositPaid: paidCents > 0 ? formatPrice(paidCents) : undefined,
        remainingAmount: remainingCents > 0 ? formatPrice(remainingCents) : undefined,
        paymentType,
      });
    } else if (type === 'notification') {
      subject = `Nieuwe boeking: ${booking.customer_name} — ${service.name}`;
      to = salon.email;
      html = notificationTemplate({
        customerName: escapeHtml(booking.customer_name), customerPhone: escapeHtml(booking.customer_phone),
        customerEmail: escapeHtml(booking.customer_email), serviceName: escapeHtml(service.name),
        duration: service.duration_min, staffName: escapeHtml(staff.name), date, startTime, endTime,
      });
    } else if (type === 'cancellation') {
      subject = `Afspraak geannuleerd: ${date} ${startTime}`;
      to = booking.customer_email;
      html = cancellationTemplate({
        customerName: escapeHtml(booking.customer_name), serviceName: escapeHtml(service.name),
        date, startTime, salonName: escapeHtml(salon.name), salonEmail: escapeHtml(salon.email),
      });
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email type' }) };
    }

    const fromName = type === 'notification' ? 'Boekingssysteem' : salon.name;

    await transporter.sendMail({
      from: `${fromName} <${process.env.SMTP_USER || 'boekingen@ensalabs.nl'}>`,
      to,
      subject,
      html,
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Email send error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};

export { handler };
