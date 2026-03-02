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

function googleCalendarUrl(d: any): string {
  const startDt = d.startIso.replace(/[-:]/g, '').replace('.000Z', 'Z').replace(/\.\d{3}Z/, 'Z');
  const endDt = d.endIso.replace(/[-:]/g, '').replace('.000Z', 'Z').replace(/\.\d{3}Z/, 'Z');
  const location = [d.salonAddress, d.salonPostalCode, d.salonCity].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${d.serviceName} bij ${d.salonName}`,
    dates: `${startDt}/${endDt}`,
    details: `Behandeling: ${d.serviceName}\nBij: ${d.staffName}\n\n${d.salonName}${d.salonPhone ? `\nTel: ${d.salonPhone}` : ''}`,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface SalonBranding {
  brandColor: string;
  brandColorText: string;
  gradientEnabled: boolean;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: string;
  logoUrl?: string;
  salonName: string;
  footerText?: string;
}

function getBrandBackground(b: SalonBranding): string {
  if (b.gradientEnabled && b.gradientFrom && b.gradientTo) {
    return `linear-gradient(${b.gradientDirection || '135deg'}, ${b.gradientFrom}, ${b.gradientTo})`;
  }
  return b.brandColor;
}

function brandedEmailWrapper(branding: SalonBranding, content: string): string {
  const { brandColor, brandColorText, logoUrl, salonName, footerText } = branding;
  const bgStyle = getBrandBackground(branding);
  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(salonName)}" style="max-height:48px;max-width:180px;display:block;margin:0 auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:${brandColorText};letter-spacing:-0.5px;">${esc(salonName)}</span>`;

  const footerLine = footerText
    ? `<p style="color:#94A3B8;font-size:13px;margin:8px 0 0;font-style:italic;">${esc(footerText)}</p>`
    : '';

  // Email gradient: use background shorthand with solid fallback for Outlook
  const headerBg = branding.gradientEnabled
    ? `background-color:${brandColor};background:${bgStyle};`
    : `background:${brandColor};`;

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!--[if mso]><style>td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#F7F7F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F5;padding:24px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <!-- Branded header with gradient support -->
        <tr>
          <td style="${headerBg}padding:20px 24px;text-align:center;">
            ${logoHtml}
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:28px 24px 20px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 24px 20px;text-align:center;border-top:1px solid #F1F1EF;">
            ${footerLine}
            <p style="color:#CBD5E1;font-size:11px;margin:8px 0 0;">Powered by <a href="https://bellure.nl" style="color:#CBD5E1;text-decoration:underline;">Bellure</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function confirmationHtml(d: any): string {
  // Payment section
  let paymentSection = '';
  if (d.paymentType === 'deposit' && d.depositPaid) {
    paymentSection = `
      <div style="margin:16px 0;padding:14px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
        <div style="font-size:13px;color:#166534;font-weight:600;margin-bottom:8px;">Betaaloverzicht</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#166534;font-size:14px;">Aanbetaald</td><td style="text-align:right;font-weight:600;color:#059669;font-size:14px;">${d.depositPaid}</td></tr>
          <tr><td style="padding:4px 0;color:#166534;font-size:14px;">Restbedrag in salon</td><td style="text-align:right;font-weight:600;color:#166534;font-size:14px;">${d.remainingAmount}</td></tr>
        </table>
      </div>`;
  } else if (d.paymentType === 'full' && d.depositPaid) {
    paymentSection = `
      <div style="margin:16px 0;padding:14px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
        <div style="font-size:14px;color:#059669;font-weight:600;">Volledig betaald: ${d.depositPaid}</div>
      </div>`;
  }

  // Location section
  const hasAddress = d.salonAddress || d.salonCity;
  const fullAddress = [d.salonAddress, [d.salonPostalCode, d.salonCity].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const mapsUrl = hasAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : '';
  const locationSection = hasAddress ? `
    <div style="margin:16px 0;padding:14px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
      <div style="font-size:13px;color:#64748B;font-weight:600;margin-bottom:6px;">Locatie</div>
      <div style="font-size:14px;color:#1E293B;">${esc(fullAddress)}</div>
      ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;color:${d.brandColor};font-size:13px;text-decoration:none;">Bekijk op Google Maps &rarr;</a>` : ''}
      ${d.locationInfo ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #E2E8F0;font-size:13px;color:#64748B;">${esc(d.locationInfo)}</div>` : ''}
    </div>` : '';

  // Cancellation policy
  const policySection = d.cancellationPolicy ? `
    <div style="margin:16px 0;padding:12px;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;font-size:13px;color:#92400E;">
      <strong>Annuleringsbeleid:</strong> ${esc(d.cancellationPolicy)}
    </div>` : '';

  // Calendar link
  const calendarLink = d.calendarUrl ? `
    <a href="${d.calendarUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 20px;${d.brandBg}color:${d.brandColorText};border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Voeg toe aan agenda</a>` : '';

  // Action buttons
  const rescheduleBtn = d.rescheduleUrl ? `
    <a href="${d.rescheduleUrl}" style="display:inline-block;padding:10px 20px;background:#F5F3FF;color:${d.brandColor};border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;border:1px solid #DDD6FE;">Afspraak verplaatsen</a>` : '';
  const cancelBtn = d.cancelUrl
    ? `<a href="${d.cancelUrl}" style="display:inline-block;padding:10px 20px;background:#FEF2F2;color:#DC2626;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Afspraak annuleren</a>`
    : '';

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1E293B;">
    <div style="text-align:center;padding:24px 0 16px;">
      <div style="display:inline-block;width:48px;height:48px;${d.brandBg}border-radius:50%;line-height:48px;text-align:center;">
        <span style="color:#fff;font-size:20px;">&#10003;</span>
      </div>
      <h2 style="color:${d.brandColor};margin:12px 0 4px;font-size:22px;">Afspraak bevestigd</h2>
    </div>

    <p style="font-size:15px;">Hoi ${d.customerName},</p>
    <p style="font-size:15px;color:#475569;">Je afspraak bij <strong>${d.salonName}</strong> is bevestigd. Hieronder de details:</p>

    <div style="margin:20px 0;padding:16px;background:#fff;border-radius:10px;border:1px solid #E2E8F0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748B;font-size:14px;width:110px;">Behandeling</td><td style="font-size:14px;"><strong>${d.serviceName}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748B;font-size:14px;">Bij</td><td style="font-size:14px;"><strong>${d.staffName}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748B;font-size:14px;">Datum</td><td style="font-size:14px;"><strong>${d.date}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748B;font-size:14px;">Tijd</td><td style="font-size:14px;"><strong>${d.startTime} - ${d.endTime}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748B;font-size:14px;">Duur</td><td style="font-size:14px;"><strong>${d.duration} minuten</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748B;font-size:14px;">Totaalprijs</td><td style="font-size:14px;"><strong>${d.price}</strong></td></tr>
      </table>
    </div>

    ${paymentSection}
    ${locationSection}
    ${policySection}

    <div style="margin:24px 0;text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center;">
      ${calendarLink}
      ${rescheduleBtn}
      ${cancelBtn}
    </div>

    ${!d.cancelUrl && !d.rescheduleUrl ? `<p style="margin-top:16px;color:#64748B;font-size:13px;text-align:center;">Wil je je afspraak wijzigen? Neem contact op met ${d.salonName}${d.salonPhone ? ` via ${d.salonPhone}` : ''} of mail naar ${d.salonEmail}.</p>` : ''}
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
    <p style="margin-top:16px;"><a href="${d.adminUrl}" style="color:${d.brandColor};">Bekijk in dashboard</a></p>
  </div>`;
}

function cancellationHtml(d: any): string {
  const refundSection = d.amountPaid > 0
    ? `<div style="margin:16px 0;padding:14px;background:#FFF7ED;border-radius:8px;border:1px solid #FED7AA;font-size:14px;color:#9A3412;">
        <strong>Betaling:</strong> Je had ${d.amountPaidFormatted} ${d.paymentType === 'deposit' ? 'aanbetaald' : 'betaald'}. 
        ${d.refundStatus === 'refunded' ? 'Dit bedrag is teruggestort.' : d.refundStatus === 'pending' ? 'De terugbetaling wordt verwerkt.' : `Neem contact op met ${d.salonName} over de terugbetaling.`}
      </div>` : '';

  const rebookSection = d.rebookUrl
    ? `<div style="margin:20px 0;text-align:center;">
        <a href="${d.rebookUrl}" style="display:inline-block;padding:12px 24px;${d.brandBg}color:${d.brandColorText};border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Nieuwe afspraak maken</a>
      </div>` : '';

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1E293B;">
    <div style="text-align:center;padding:24px 0 16px;">
      <h2 style="color:#EF4444;font-size:22px;">Afspraak geannuleerd</h2>
    </div>
    <p style="font-size:15px;">Hoi ${d.customerName},</p>
    <p style="font-size:15px;color:#475569;">Je afspraak bij <strong>${d.salonName}</strong> is geannuleerd:</p>
    <div style="margin:16px 0;padding:14px;background:#FEF2F2;border-radius:8px;border:1px solid #FECACA;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#991B1B;font-size:14px;">Behandeling</td><td style="font-size:14px;"><strong>${d.serviceName}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#991B1B;font-size:14px;">Datum</td><td style="font-size:14px;"><strong>${d.date}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#991B1B;font-size:14px;">Tijd</td><td style="font-size:14px;"><strong>${d.startTime}</strong></td></tr>
      </table>
    </div>
    ${refundSection}
    ${rebookSection}
  </div>`;
}

function cancellationNotificationHtml(d: any): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1E293B;">
    <h2 style="color:#EF4444;">Afspraak geannuleerd door klant</h2>
    <div style="margin:16px 0;padding:14px;background:#FEF2F2;border-radius:8px;border:1px solid #FECACA;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#991B1B;font-size:14px;">Klant</td><td style="font-size:14px;"><strong>${d.customerName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#991B1B;font-size:14px;">Telefoon</td><td style="font-size:14px;">${d.customerPhone}</td></tr>
        <tr><td style="padding:6px 0;color:#991B1B;font-size:14px;">Behandeling</td><td style="font-size:14px;">${d.serviceName}</td></tr>
        <tr><td style="padding:6px 0;color:#991B1B;font-size:14px;">Medewerker</td><td style="font-size:14px;">${d.staffName}</td></tr>
        <tr><td style="padding:6px 0;color:#991B1B;font-size:14px;">Datum/Tijd</td><td style="font-size:14px;"><strong>${d.date}, ${d.startTime}</strong></td></tr>
      </table>
    </div>
    ${d.amountPaid > 0 ? `<p style="font-size:14px;color:#92400E;padding:10px;background:#FFFBEB;border-radius:8px;">Klant had ${d.amountPaidFormatted} ${d.paymentType === 'deposit' ? 'aanbetaald' : 'betaald'}.</p>` : ''}
    <p style="margin-top:16px;"><a href="${d.adminUrl}" style="color:${d.brandColor};">Bekijk in dashboard</a></p>
  </div>`;
}

function reminder24hHtml(d: any): string {
  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
    <h2 style="color:${d.brandColor};">Herinnering: morgen je afspraak</h2>
    <p>Hoi ${d.customerName},</p>
    <p>Even een herinnering: morgen heb je een afspraak bij <strong>${d.salonName}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#666;">Behandeling</td><td><strong>${d.serviceName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Bij</td><td><strong>${d.staffName}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Datum</td><td><strong>${d.date}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Tijd</td><td><strong>${d.startTime}</strong></td></tr>
    </table>
    ${d.cancelUrl
      ? `<p style="margin-top:16px;text-align:center;"><a href="${d.cancelUrl}" style="color:#DC2626;font-size:13px;text-decoration:underline;">Kan je niet? Annuleer je afspraak</a></p>`
      : `<p style="margin-top:16px;color:#666;font-size:13px;">Kan je niet komen? Neem contact op met ${d.salonName}.</p>`}
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
    <p style="color:#999;font-size:12px;">${d.salonName} · Powered by Bellure</p>
  </div>`;
}

function reviewRequestHtml(d: any): string {
  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
    <h2 style="color:${d.brandColor};">Hoe was je bezoek?</h2>
    <p>Hoi ${d.customerName},</p>
    <p>Bedankt voor je bezoek aan <strong>${d.salonName}</strong>! We hopen dat je tevreden bent.</p>
    <p>Zou je een moment willen nemen om een review achter te laten? Het helpt ons enorm en andere klanten weten dan ook wat ze kunnen verwachten.</p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${d.reviewUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;${d.brandBg}color:${d.brandColorText};text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
        Laat een review achter
      </a>
    </div>
    <p style="color:#666;font-size:13px;">Het kost maar een minuutje. Alvast bedankt!</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
    <p style="color:#999;font-size:12px;">${d.salonName} · Powered by Bellure</p>
  </div>`;
}

function reminder1hHtml(d: any): string {
  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
    <h2 style="color:${d.brandColor};">Over een uur: je afspraak</h2>
    <p>Hoi ${d.customerName},</p>
    <p>Over een uur word je verwacht bij <strong>${d.salonName}</strong> voor <strong>${d.serviceName}</strong> bij ${d.staffName}.</p>
    <p style="margin:16px 0;padding:12px;background:#F5F3FF;border-radius:8px;text-align:center;font-size:16px;font-weight:500;">
      Vandaag om <strong>${d.startTime}</strong>
    </p>
    <p style="color:#666;font-size:14px;">Tot zo!</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
    <p style="color:#999;font-size:12px;">${d.salonName} · Powered by Bellure</p>
  </div>`;
}

/**
 * Send email via SMTP using a simple fetch to an external relay.
 * Email sending via Resend API
 * which is free for Cloudflare Workers (no API key needed, uses CF worker verification).
 */
async function sendResend(apiKey: string, from: string, fromName: string, to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  const payload: any = {
    from: `${fromName} <${from}>`,
    to: [to],
    subject,
    html,
  };
  if (replyTo) {
    payload.reply_to = [replyTo];
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('Resend error:', res.status, errBody);
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

  const [salonRes, serviceRes, staffRes, bookingServicesRes] = await Promise.all([
    supabase.from('salons').select('*').eq('id', salonId).single(),
    supabase.from('services').select('*').eq('id', booking.service_id).single(),
    supabase.from('staff').select('*').eq('id', booking.staff_id).single(),
    supabase.from('booking_services').select('service_id, price_cents, duration_min, services:service_id(name)').eq('booking_id', bookingId).order('sort_order'),
  ]);

  const salon = salonRes.data!, service = serviceRes.data!, staff = staffRes.data!;
  const bookingServices = bookingServicesRes.data || [];

  // Use booking_services for display name if available, fallback to notes, then primary service
  const displayServiceName = bookingServices.length > 1
    ? bookingServices.map((bs: any) => bs.services?.name || '').filter(Boolean).join(' + ')
    : booking.notes || service.name;
  const date = formatDate(booking.start_at);
  const startTime = formatTime(booking.start_at);
  const endTime = formatTime(booking.end_at);
  const smtpUser = c.env.SMTP_USER || 'boekingen@ensalabs.nl';

  let subject = '', to = '', html = '';

  // Total price from booking or primary service
  const totalPriceCents = booking.amount_total_cents || service.price_cents;
  const totalDurationMin = bookingServices.length > 0
    ? bookingServices.reduce((sum: number, bs: any) => sum + (bs.duration_min || 0), 0)
    : service.duration_min;

  // Build branding early so templates can use it for accent colors/buttons
  const _brandColor = salon.brand_color || '#8B5CF6';
  const _brandColorText = salon.brand_color_text || '#FFFFFF';
  const _gradientEnabled = salon.brand_gradient_enabled || false;
  const _gradientFrom = salon.brand_gradient_from || _brandColor;
  const _gradientTo = salon.brand_gradient_to || '#6366F1';
  const _gradientDir = salon.brand_gradient_direction || '135deg';
  const _brandBg = _gradientEnabled
    ? `background-color:${_brandColor};background:linear-gradient(${_gradientDir},${_gradientFrom},${_gradientTo});`
    : `background:${_brandColor};`;
  const _brandBgShort = _gradientEnabled
    ? `linear-gradient(${_gradientDir},${_gradientFrom},${_gradientTo})`
    : _brandColor;

  const apiBase = c.env.SITE_URL || 'https://api.bellure.nl';
  const frontendUrl = c.env.FRONTEND_URL || 'https://mijn.bellure.nl';
  const cancelUrl = booking.cancel_token
    ? `${apiBase}/api/cancel?token=${booking.cancel_token}`
    : undefined;
  // Reschedule URL: links to booking widget with pre-filled salon
  const rescheduleUrl = salon.reschedule_enabled !== false
    ? `${frontendUrl}?salon=${salon.slug}`
    : undefined;

  if (type === 'confirmation') {
    subject = `Bevestiging: ${displayServiceName} bij ${salon.name}`;
    to = booking.customer_email;
    const paidCents = booking.amount_paid_cents || 0;
    const remainingCents = totalPriceCents - paidCents;
    const calData = {
      serviceName: esc(displayServiceName), salonName: esc(salon.name),
      staffName: esc(staff.name), startIso: booking.start_at, endIso: booking.end_at,
      salonAddress: salon.address, salonPostalCode: salon.postal_code, salonCity: salon.city,
      salonPhone: salon.phone,
    };
    html = confirmationHtml({
      customerName: esc(booking.customer_name), serviceName: esc(displayServiceName), staffName: esc(staff.name),
      date, startTime, endTime, duration: totalDurationMin, price: formatPrice(totalPriceCents),
      salonName: esc(salon.name), salonEmail: esc(salon.email), salonPhone: salon.phone,
      salonAddress: salon.address, salonCity: salon.city, salonPostalCode: salon.postal_code,
      locationInfo: salon.location_info,
      cancellationPolicy: salon.cancellation_policy,
      depositPaid: paidCents > 0 ? formatPrice(paidCents) : undefined,
      remainingAmount: remainingCents > 0 ? formatPrice(remainingCents) : undefined,
      paymentType: booking.payment_type || 'none',
      cancelUrl,
      rescheduleUrl,
      calendarUrl: googleCalendarUrl(calData),
      brandColor: _brandColor, brandBg: _brandBg, brandColorText: _brandColorText,
    });
  } else if (type === 'notification') {
    subject = `Nieuwe boeking: ${booking.customer_name} — ${displayServiceName}`;
    to = salon.email;
    const frontendUrl = c.env.FRONTEND_URL || 'https://mijn.bellure.nl';
    html = notificationHtml({
      customerName: esc(booking.customer_name), customerPhone: esc(booking.customer_phone),
      customerEmail: esc(booking.customer_email), serviceName: esc(displayServiceName),
      duration: totalDurationMin, staffName: esc(staff.name), date, startTime, endTime,
      adminUrl: `${frontendUrl}/admin/bookings`,
      brandColor: _brandColor, brandBg: _brandBg, brandColorText: _brandColorText,
    });
  } else if (type === 'cancellation') {
    subject = `Afspraak geannuleerd: ${date} ${startTime}`;
    to = booking.customer_email;
    html = cancellationHtml({
      customerName: esc(booking.customer_name), serviceName: esc(displayServiceName),
      date, startTime,
      salonName: esc(salon.name), salonEmail: esc(salon.email), salonPhone: salon.phone,
      amountPaid: booking.amount_paid_cents || 0,
      amountPaidFormatted: booking.amount_paid_cents > 0 ? formatPrice(booking.amount_paid_cents) : '',
      paymentType: booking.payment_type || 'none',
      refundStatus: booking.refund_status || 'none',
      rebookUrl: `${frontendUrl}?salon=${salon.slug}`,
      brandColor: _brandColor, brandBg: _brandBg, brandColorText: _brandColorText,
    });
  } else if (type === 'cancellation_notification') {
    subject = `Annulering: ${booking.customer_name} — ${displayServiceName} op ${date}`;
    to = salon.email;
    html = cancellationNotificationHtml({
      customerName: esc(booking.customer_name), customerPhone: esc(booking.customer_phone),
      serviceName: esc(displayServiceName), staffName: esc(staff.name), date, startTime,
      amountPaid: booking.amount_paid_cents || 0,
      amountPaidFormatted: booking.amount_paid_cents > 0 ? formatPrice(booking.amount_paid_cents) : '',
      paymentType: booking.payment_type || 'none',
      adminUrl: `${frontendUrl}/admin/bookings`,
      brandColor: _brandColor, brandBg: _brandBg, brandColorText: _brandColorText,
    });
  } else if (type === 'reminder_24h') {
    subject = `Herinnering: morgen je afspraak bij ${salon.name}`;
    to = booking.customer_email;
    html = reminder24hHtml({
      customerName: esc(booking.customer_name), serviceName: esc(displayServiceName),
      staffName: esc(staff.name), date, startTime,
      salonName: esc(salon.name), cancelUrl,
      brandColor: _brandColor, brandBg: _brandBg, brandColorText: _brandColorText,
    });
  } else if (type === 'reminder_1h') {
    subject = `Over een uur: ${displayServiceName} bij ${salon.name}`;
    to = booking.customer_email;
    html = reminder1hHtml({
      customerName: esc(booking.customer_name), serviceName: esc(displayServiceName),
      staffName: esc(staff.name), startTime, salonName: esc(salon.name),
      brandColor: _brandColor, brandBg: _brandBg, brandColorText: _brandColorText,
    });
  } else if (type === 'review_request') {
    // Build Google review URL from Place ID
    const googlePlaceId = (salon as any).google_place_id;
    if (!googlePlaceId) return c.json({ error: 'No Google Place ID' }, 400);
    const reviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId)}`;
    subject = `Hoe was je bezoek bij ${salon.name}?`;
    to = booking.customer_email;
    html = reviewRequestHtml({
      customerName: esc(booking.customer_name),
      salonName: esc(salon.name),
      reviewUrl,
      brandColor: _brandColor, brandBg: _brandBg, brandColorText: _brandColorText,
    });
  } else {
    return c.json({ error: 'Invalid email type' }, 400);
  }

  // Check email preferences: if this email type is disabled, skip sending
  const emailPrefs = salon.email_preferences || {};
  if (emailPrefs[type] === false) {
    return c.json({ success: true, skipped: true, reason: 'Email type disabled by salon' });
  }

  // Wrap HTML in branded email template
  const branding: SalonBranding = {
    brandColor: salon.brand_color || '#8B5CF6',
    brandColorText: salon.brand_color_text || '#FFFFFF',
    gradientEnabled: salon.brand_gradient_enabled || false,
    gradientFrom: salon.brand_gradient_from || salon.brand_color || '#8B5CF6',
    gradientTo: salon.brand_gradient_to || '#6366F1',
    gradientDirection: salon.brand_gradient_direction || '135deg',
    logoUrl: salon.logo_url || undefined,
    salonName: salon.name,
    footerText: salon.email_footer_text || undefined,
  };
  html = brandedEmailWrapper(branding, html);

  const fromEmail = 'noreply@bellure.nl';
  const fromName = ['notification', 'cancellation_notification'].includes(type)
    ? 'Bellure Boekingen'
    : salon.name;

  // Add Reply-To salon email for customer-facing mails
  const replyTo = !['notification', 'cancellation_notification'].includes(type)
    ? salon.email
    : undefined;

  const resendKey = c.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('RESEND_API_KEY not configured');
    return c.json({ success: false, error: 'Email not configured' }, 500);
  }

  const success = await sendResend(resendKey, fromEmail, fromName, to, subject, html, replyTo);

  return c.json({ success });
}
