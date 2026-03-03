import { Context } from 'hono';
import type { Env } from '../api';

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

// POST /api/trial/register — Self-service trial registration
export async function trialRegister(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json();
    const { salonName, ownerName, ownerEmail, password } = body;

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
    if (!password || password.length < 8) {
      return c.json({ error: 'Wachtwoord moet minimaal 8 tekens zijn' }, 400);
    }

    const supabaseUrl = c.env.SUPABASE_URL;
    const serviceKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

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
        trial_started_at: now,
        trial_ends_at: trialEnds,
        subscription_status: 'trial',
        plan_type: 'booking_standalone',
      }),
    });

    if (!salonRes.ok) {
      const err = await salonRes.text();
      console.error('Salon creation failed:', err);
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
        email: ownerEmail.trim(),
        name: ownerName.trim(),
        role: 'owner',
      }),
    });

    if (!suRes.ok) {
      console.error('salon_users creation failed:', await suRes.text());
    }

    return c.json({
      salonId: salon.id,
      slug: salon.slug,
      trialEndsAt: trialEnds,
    });
  } catch (err: any) {
    console.error('Trial register error:', err);
    return c.json({ error: 'Er ging iets mis. Probeer het later opnieuw.' }, 500);
  }
}

// GET /api/trial/status?salon_id=xxx — Check trial status
export async function trialStatus(c: Context<{ Bindings: Env }>) {
  const salonId = c.req.query('salon_id');
  if (!salonId) {
    return c.json({ error: 'salon_id is verplicht' }, 400);
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

  return c.json({
    status: salon.subscription_status || 'none',
    daysRemaining,
    trialEndsAt: salon.trial_ends_at,
  });
}
