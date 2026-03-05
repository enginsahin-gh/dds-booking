import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { verifyUser } from '../lib/auth';

// Global customer profile (across salons) based on auth email
export async function getCustomerProfileGlobal(c: Context<{ Bindings: Env }>) {
  const auth = await verifyUser(c);
  if (!auth || !auth.email) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase(c.env);

  const { data, error } = await supabase
    .from('customers')
    .select('name, email, phone, created_at')
    .ilike('email', auth.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return c.json({ profile: null });
  return c.json({ profile: data });
}

export async function updateCustomerProfileGlobal(c: Context<{ Bindings: Env }>) {
  const auth = await verifyUser(c);
  if (!auth || !auth.email) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  const phone = (body.phone as string | undefined)?.trim();

  if (!name) return c.json({ error: 'name required' }, 400);

  const supabase = getSupabase(c.env);

  const { error } = await supabase
    .from('customers')
    .update({ name, phone: phone || null })
    .ilike('email', auth.email);

  if (error) return c.json({ error: 'update_failed' }, 500);

  return c.json({ success: true });
}
