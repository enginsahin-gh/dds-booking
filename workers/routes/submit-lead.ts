import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import type { Env } from '../api';
import { rateLimit } from '../lib/rate-limit';
import { logError } from '../lib/logger';

interface LeadPayload {
  salon_name?: string;
  contact_person?: string;
  contact_method: string;
  current_website?: string;
  message?: string;
  capture_type?: 'popup' | 'form';
}

export const submitLead = async (c: Context<{ Bindings: Env }>) => {
  try {
    const body = await c.req.json<LeadPayload>();

    // Validation
    if (!body.contact_method?.trim()) {
      return c.json({ error: 'Vul een e-mailadres of telefoonnummer in.' }, 400);
    }
    const isPopup = body.capture_type === 'popup';
    if (!isPopup && (!body.salon_name?.trim() || !body.contact_person?.trim())) {
      return c.json({ error: 'Vul alle verplichte velden in.' }, 400);
    }

    // Basic email/phone validation
    const method = body.contact_method.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(method);
    const isPhone = /^[\d\s\-+()]{8,}$/.test(method);
    if (!isEmail && !isPhone) {
      return c.json({ error: 'Vul een geldig e-mailadres of telefoonnummer in.' }, 400);
    }

    const rate = await rateLimit(c, 'submit-lead', 5, 3600);
    if (!rate.ok) {
      const retryAfter = Math.max(0, rate.reset - Math.floor(Date.now() / 1000));
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'RATE_LIMITED' }, 429);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase.from('leads').insert({
      salon_name: body.salon_name?.trim() || (isPopup ? 'Popup lead' : null),
      contact_person: body.contact_person?.trim() || (isPopup ? 'Onbekend' : null),
      contact_method: method,
      current_website: body.current_website?.trim() || null,
      message: body.message?.trim() || (isPopup ? 'Exit intent popup' : null),
      source: isPopup ? 'bellure-popup' : 'bellure-site',
    }).select('id').single();

    if (error) {
      logError(c, 'Lead insert error', { message: error.message });
      return c.json({ error: 'Er ging iets mis. Probeer het later opnieuw.' }, 500);
    }

    // Send notification email to hello@ensalabs.nl
    try {
      await sendNotification(c.env, body);
    } catch (emailErr) {
      logError(c, 'Lead notification email failed', { message: emailErr instanceof Error ? emailErr.message : String(emailErr) });
      // Don't fail the request if email fails
    }

    return c.json({ success: true, message: 'Bedankt! We nemen binnen 24 uur contact op.' });
  } catch (err) {
    logError(c, 'Submit lead error', { message: err instanceof Error ? err.message : String(err) });
    return c.json({ error: 'Er ging iets mis. Probeer het later opnieuw.' }, 500);
  }
};

// SEC-019: HTML escape helper to prevent XSS in email content
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendNotification(env: Env, lead: LeadPayload) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Bellure <noreply@bellure.nl>',
      to: 'hello@ensalabs.nl',
      subject: `Nieuwe aanvraag: ${esc(lead.salon_name)}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <h2 style="color:#1E293B;margin-bottom:16px;">Nieuwe aanvraag via bellure.nl</h2>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Salon:</td><td style="padding:8px 0;color:#1E293B;">${esc(lead.salon_name)}</td></tr>
            <tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Contact:</td><td style="padding:8px 0;color:#1E293B;">${esc(lead.contact_person)}</td></tr>
            <tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Bereikbaar op:</td><td style="padding:8px 0;color:#1E293B;">${esc(lead.contact_method)}</td></tr>
            ${lead.current_website ? `<tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Huidige website:</td><td style="padding:8px 0;color:#1E293B;">${esc(lead.current_website)}</td></tr>` : ''}
            ${lead.message ? `<tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Bericht:</td><td style="padding:8px 0;color:#1E293B;">${esc(lead.message)}</td></tr>` : ''}
          </table>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />
          <p style="color:#CBD5E1;font-size:11px;">Powered by Bellure</p>
        </div>
      `,
    }),
  });
}
