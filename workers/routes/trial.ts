import { Context } from 'hono';
import type { Env } from '../api';
import { verifyAuth } from '../lib/auth';
import { logError } from '../lib/logger';
import { rateLimit } from '../lib/rate-limit';

// Slugify helper
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// POST /api/trial/apply — Trial application (manual approval)
export async function trialApply(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json();
    const { salonName, ownerName, email, phone, city, website, instagram } = body || {};

    if (!salonName || salonName.trim().length < 2) {
      return c.json({ error: 'Salonnaam is verplicht' }, 400);
    }
    if (!ownerName || ownerName.trim().length < 2) {
      return c.json({ error: 'Naam is verplicht' }, 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: 'Ongeldig e-mailadres' }, 400);
    }

    const rate = await rateLimit(c, 'trial-apply', 5, 3600, email.trim().toLowerCase());
    if (!rate.ok) {
      return c.json({ error: 'Te veel aanvragen, probeer later opnieuw' }, 429);
    }

    const supabaseUrl = c.env.SUPABASE_URL;
    const serviceKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

    // Prevent duplicate pending applications
    const pendingRes = await fetch(
      `${supabaseUrl}/rest/v1/trial_applications?select=id&email=eq.${encodeURIComponent(email.trim().toLowerCase())}&status=eq.pending&limit=1`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const pending = await pendingRes.json() as any[];
    if (pending && pending.length > 0) {
      return c.json({ success: true, message: 'Aanvraag ontvangen. We nemen contact op.' });
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/trial_applications`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        salon_name: salonName.trim(),
        owner_name: ownerName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        city: city?.trim() || null,
        website: website?.trim() || null,
        instagram: instagram?.trim() || null,
        status: 'pending',
      }),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      logError(c, 'Trial apply insert failed', { message: err });
      return c.json({ error: 'Kon aanvraag niet verwerken' }, 500);
    }

    const [application] = await insertRes.json() as any[];

    const approveUrl = `${c.env.SITE_URL}/api/trial/approve?token=${application.approval_token}`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Bellure <noreply@bellure.nl>',
          to: 'hello@bellure.nl',
          subject: `Nieuwe trial aanvraag: ${esc(salonName)}`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
              <h2 style="margin:0 0 16px;color:#1E293B;">Nieuwe trial aanvraag</h2>
              <table style="border-collapse:collapse;width:100%;">
                <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#475569;">Salon</td><td style="padding:6px 0;color:#1E293B;">${esc(salonName)}</td></tr>
                <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#475569;">Contact</td><td style="padding:6px 0;color:#1E293B;">${esc(ownerName)}</td></tr>
                <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#475569;">Email</td><td style="padding:6px 0;color:#1E293B;">${esc(email)}</td></tr>
                ${phone ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#475569;">Telefoon</td><td style="padding:6px 0;color:#1E293B;">${esc(phone)}</td></tr>` : ''}
                ${city ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#475569;">Plaats</td><td style="padding:6px 0;color:#1E293B;">${esc(city)}</td></tr>` : ''}
                ${website ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#475569;">Website</td><td style="padding:6px 0;color:#1E293B;">${esc(website)}</td></tr>` : ''}
                ${instagram ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#475569;">Instagram</td><td style="padding:6px 0;color:#1E293B;">${esc(instagram)}</td></tr>` : ''}
              </table>
              <div style="margin:20px 0 8px;">
                <a href="${approveUrl}" style="display:inline-block;background:#3B4E6C;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Aanvraag goedkeuren</a>
              </div>
              <p style="color:#94A3B8;font-size:12px;">Na goedkeuring krijg je een unieke registratie‑link.</p>
            </div>
          `,
        }),
      });
    } catch (emailErr) {
      logError(c, 'Trial apply email failed', { message: emailErr instanceof Error ? emailErr.message : String(emailErr) });
    }

    return c.json({ success: true, message: 'Aanvraag ontvangen. We nemen contact op.' });
  } catch (err) {
    logError(c, 'Trial apply error', { message: err instanceof Error ? err.message : String(err) });
    return c.json({ error: 'Er ging iets mis. Probeer het later opnieuw.' }, 500);
  }
}

// GET /api/trial/approve?token=xxx — Approve application
export async function trialApprove(c: Context<{ Bindings: Env }>) {
  try {
    const token = c.req.query('token');
    if (!token) return c.text('Ongeldig token', 400);

    const supabaseUrl = c.env.SUPABASE_URL;
    const serviceKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

    const appRes = await fetch(
      `${supabaseUrl}/rest/v1/trial_applications?select=*&approval_token=eq.${encodeURIComponent(token)}&limit=1`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const apps = await appRes.json() as any[];
    if (!apps || apps.length === 0) return c.text('Aanvraag niet gevonden', 404);
    const application = apps[0];

    if (application.status !== 'approved') {
      await fetch(`${supabaseUrl}/rest/v1/trial_applications?id=eq.${application.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'approved', approved_at: new Date().toISOString() }),
      });
    }

    const registerUrl = `${c.env.FRONTEND_URL}/admin/registreren?token=${application.register_token}`;

    return c.html(`
      <!DOCTYPE html>
      <html lang="nl">
      <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Trial goedgekeurd</title></head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;">
        <h2 style="color:#1E293B;">Trial goedgekeurd</h2>
        <p>Stuur deze registratie‑link naar de salon:</p>
        <p><a href="${registerUrl}">${registerUrl}</a></p>
      </body>
      </html>
    `);
  } catch (err) {
    logError(c, 'Trial approve error', { message: err instanceof Error ? err.message : String(err) });
    return c.text('Er ging iets mis', 500);
  }
}

// POST /api/trial/register — Self-service trial registration
export async function trialRegister(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json();
    const { salonName, ownerName, ownerEmail, password, applicationToken } = body;

    // Validation
    if (!salonName || salonName.trim().length < 2) {
      return c.json({ error: 'Salonnaam moet minimaal 2 tekens zijn' }, 400);
    }
    if (!ownerName || ownerName.trim().length < 2) {
      return c.json({ error: 'Naam is verplicht' }, 400);
    }
    if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      return c.json({ error: 'Ongeldig e-mailadres' }, 400);
    }
    // SEC-024: Stronger password policy
    if (!password || password.length < 10) {
      return c.json({ error: 'Wachtwoord moet minimaal 10 tekens zijn' }, 400);
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return c.json({ error: 'Wachtwoord moet letters (hoofd + klein) en cijfers bevatten' }, 400);
    }

    if (!applicationToken) {
      return c.json({ error: 'Registratie is alleen mogelijk na goedkeuring' }, 403);
    }

    const supabaseUrl = c.env.SUPABASE_URL;
    const serviceKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

    const appRes = await fetch(
      `${supabaseUrl}/rest/v1/trial_applications?select=*&register_token=eq.${encodeURIComponent(applicationToken)}&limit=1`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const apps = await appRes.json() as any[];
    if (!apps || apps.length === 0) {
      return c.json({ error: 'Ongeldige of verlopen link' }, 403);
    }
    const application = apps[0];
    if (application.status !== 'approved') {
      return c.json({ error: 'Aanvraag is nog niet goedgekeurd' }, 403);
    }
    if (application.registered_at) {
      return c.json({ error: 'Deze link is al gebruikt' }, 409);
    }
    if (application.email && application.email !== ownerEmail.trim().toLowerCase()) {
      return c.json({ error: 'Gebruik hetzelfde e-mailadres als de aanvraag' }, 400);
    }

    // SEC-006: Rate limiting — max 3 registrations per hour (global, checked via DB)
    const rateLimitRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/count_recent_salons`,
      {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    // Fallback: direct query if RPC not available
    if (!rateLimitRes.ok) {
      const countRes = await fetch(
        `${supabaseUrl}/rest/v1/salons?select=id&created_at=gte.${new Date(Date.now() - 3600000).toISOString()}&limit=4`,
        {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
        }
      );
      const recentSalons = await countRes.json() as any[];
      if (recentSalons && recentSalons.length > 3) {
        return c.json({ error: 'Te veel registraties, probeer later opnieuw' }, 429);
      }
    } else {
      const count = await rateLimitRes.json() as number;
      if (count > 3) {
        return c.json({ error: 'Te veel registraties, probeer later opnieuw' }, 429);
      }
    }

    // Check duplicate email
    const existingRes = await fetch(`${supabaseUrl}/rest/v1/salon_users?email=eq.${encodeURIComponent(ownerEmail.trim())}`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    });
    const existing = await existingRes.json() as any[];
    if (existing && existing.length > 0) {
      return c.json({ error: 'Er bestaat al een account met dit e-mailadres' }, 409);
    }

    // Create Supabase auth user
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: ownerEmail.trim(),
        password,
        email_confirm: true,
        user_metadata: { name: ownerName.trim() },
      }),
    });

    if (!authRes.ok) {
      const err = await authRes.text();
      if (err.includes('already') || err.includes('duplicate')) {
        return c.json({ error: 'Er bestaat al een account met dit e-mailadres' }, 409);
      }
      return c.json({ error: 'Kon account niet aanmaken' }, 500);
    }

    const authUser = await authRes.json() as any;
    const userId = authUser.id;

    // Create salon
    const slug = slugify(salonName.trim());
    const now = new Date().toISOString();
    const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const salonRes = await fetch(`${supabaseUrl}/rest/v1/salons`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        name: salonName.trim(),
        slug,
        email: ownerEmail.trim(),
        trial_started_at: now,
        trial_ends_at: trialEnds,
        subscription_status: 'trial',
        plan_type: 'booking_standalone',
      }),
    });

    if (!salonRes.ok) {
      const err = await salonRes.text();
      logError(c, 'Salon creation failed', { message: err instanceof Error ? err.message : String(err) });
      return c.json({ error: 'Kon salon niet aanmaken' }, 500);
    }

    const salons = await salonRes.json() as any[];
    const salon = salons[0];

    // Create salon_users record
    const suRes = await fetch(`${supabaseUrl}/rest/v1/salon_users`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        salon_id: salon.id,
        user_id: userId,
        role: 'owner',
        display_name: ownerName.trim(),
        can_see_revenue: true,
        read_scope: 'all',
        edit_scope: 'all',
      }),
    });

    if (!suRes.ok) {
      logError(c, 'salon_users creation failed');
    }

    await fetch(`${supabaseUrl}/rest/v1/trial_applications?id=eq.${application.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'registered',
        registered_at: new Date().toISOString(),
        salon_id: salon.id,
      }),
    });

    return c.json({
      salonId: salon.id,
      slug: salon.slug,
      trialEndsAt: trialEnds,
    });
  } catch (err: any) {
    logError(c, 'Trial register error', { message: err instanceof Error ? err.message : String(err) });
    return c.json({ error: 'Er ging iets mis. Probeer het later opnieuw.' }, 500);
  }
}

// GET /api/trial/status?salon_id=xxx — Check trial status
// SEC-021: Requires owner authentication
export async function trialStatus(c: Context<{ Bindings: Env }>) {
  // SEC-021: Require owner authentication
  const owner = await verifyAuth(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const salonId = c.req.query('salon_id');
  if (!salonId) {
    return c.json({ error: 'salon_id is verplicht' }, 400);
  }

  // Verify the salon belongs to the authenticated owner
  if (salonId !== owner.salonId) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const supabaseUrl = c.env.SUPABASE_URL;
  const serviceKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/salons?id=eq.${salonId}&select=subscription_status,trial_ends_at`,
    {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    }
  );

  const salons = await res.json() as any[];
  if (!salons || salons.length === 0) {
    return c.json({ error: 'Salon niet gevonden' }, 404);
  }

  const salon = salons[0];
  const trialEnds = salon.trial_ends_at ? new Date(salon.trial_ends_at) : null;
  const daysRemaining = trialEnds
    ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // SEC-021: Return only minimal fields
  return c.json({
    status: salon.subscription_status || 'none',
    daysRemaining,
  });
}
