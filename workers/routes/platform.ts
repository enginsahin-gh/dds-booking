import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { verifyPlatformAdmin } from '../lib/auth';

const ALLOWED_STATUSES = ['trial', 'active', 'paused', 'cancelled', 'none'];
const ALLOWED_PLANS = ['booking_standalone', 'booking_website', 'website_basic', null];

export async function platformMe(c: Context<{ Bindings: Env }>) {
  const auth = await verifyPlatformAdmin(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ ok: true, userId: auth.userId, email: auth.email });
}

export async function platformSalons(c: Context<{ Bindings: Env }>) {
  const auth = await verifyPlatformAdmin(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase(c.env);
  const { data, error } = await supabase
    .from('salons')
    .select('id, name, email, phone, subscription_status, trial_started_at, trial_ends_at, plan_type, mollie_connected_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: 'Failed to fetch salons' }, 500);
  return c.json({ salons: data || [] });
}

export async function platformUpdateSalon(c: Context<{ Bindings: Env }>) {
  const auth = await verifyPlatformAdmin(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const salonId = body?.salonId as string | undefined;
  const subscription_status = body?.subscription_status as string | undefined;
  const trial_ends_at = body?.trial_ends_at as string | null | undefined;
  const plan_type = body?.plan_type as string | null | undefined;

  if (!salonId) return c.json({ error: 'Missing salonId' }, 400);
  if (subscription_status && !ALLOWED_STATUSES.includes(subscription_status)) {
    return c.json({ error: 'Invalid subscription_status' }, 400);
  }
  if (plan_type !== undefined && !ALLOWED_PLANS.includes(plan_type)) {
    return c.json({ error: 'Invalid plan_type' }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (subscription_status !== undefined) updates.subscription_status = subscription_status;
  if (trial_ends_at !== undefined) updates.trial_ends_at = trial_ends_at;
  if (plan_type !== undefined) updates.plan_type = plan_type;

  const supabase = getSupabase(c.env);
  const { data, error } = await supabase
    .from('salons')
    .update(updates)
    .eq('id', salonId)
    .select('id, subscription_status, trial_ends_at, plan_type')
    .single();

  if (error) return c.json({ error: 'Update failed' }, 500);
  return c.json({ salon: data });
}
