import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import type { Env } from '../api';

interface LeadPayload {
  salon_name: string;
  contact_person: string;
  contact_method: string;
  current_website?: string;
  message?: string;
}

export const submitLead = async (c: Context<{ Bindings: Env }>) => {
  try {
    const body = await c.req.json<LeadPayload>();

    // Validation
    if (!body.salon_name?.trim() || !body.contact_person?.trim() || !body.contact_method?.trim()) {
      return c.json({ error: 'Vul alle verplichte velden in.' }, 400);
    }

    // Basic email/phone validation
    const method = body.contact_method.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(method);
    const isPhone = /^[\d\s\-+()]{8,}$/.test(method);
    if (!isEmail && !isPhone) {
      return c.json({ error: 'Vul een geldig e-mailadres of telefoonnummer in.' }, 400);
    }

    // Rate limit: simple check by IP (basic protection)
    // For production, use CF rate limiting rules

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase.from('leads').insert({
      salon_name: body.salon_name.trim(),
      contact_person: body.contact_person.trim(),
      contact_method: method,
      current_website: body.current_website?.trim() || null,
      message: body.message?.trim() || null,
      source: 'dds-site',
    }).select('id').single();

    if (error) {
      console.error('Lead insert error:', error);
      return c.json({ error: 'Er ging iets mis. Probeer het later opnieuw.' }, 500);
    }

    // Send notification email to hello@ensalabs.nl
    try {
      await sendNotification(c.env, body);
    } catch (emailErr) {
      console.error('Lead notification email failed:', emailErr);
      // Don't fail the request if email fails
    }

    return c.json({ success: true, message: 'Bedankt! We nemen binnen 24 uur contact op.' });
  } catch (err) {
    console.error('Submit lead error:', err);
    return c.json({ error: 'Er ging iets mis. Probeer het later opnieuw.' }, 500);
  }
};

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
      subject: `Nieuwe aanvraag: ${lead.salon_name}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <h2 style="color:#1E293B;margin-bottom:16px;">Nieuwe aanvraag via bellure.nl</h2>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Salon:</td><td style="padding:8px 0;color:#1E293B;">${lead.salon_name}</td></tr>
            <tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Contact:</td><td style="padding:8px 0;color:#1E293B;">${lead.contact_person}</td></tr>
            <tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Bereikbaar op:</td><td style="padding:8px 0;color:#1E293B;">${lead.contact_method}</td></tr>
            ${lead.current_website ? `<tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Huidige website:</td><td style="padding:8px 0;color:#1E293B;">${lead.current_website}</td></tr>` : ''}
            ${lead.message ? `<tr><td style="padding:8px 16px 8px 0;font-weight:600;color:#475569;">Bericht:</td><td style="padding:8px 0;color:#1E293B;">${lead.message}</td></tr>` : ''}
          </table>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />
          <p style="color:#CBD5E1;font-size:11px;">Powered by Bellure</p>
        </div>
      `,
    }),
  });
}
