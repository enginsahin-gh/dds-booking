import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { verifyUser } from '../lib/auth';

// Get customer profile linked to the auth user for a given salon
export async function getCustomerProfile(c: Context<{ Bindings: Env }>) {
  const auth = await verifyUser(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  const salonId = c.req.query('salonId');
  if (!salonId) return c.json({ error: 'salonId required' }, 400);

  const supabase = getSupabase(c.env);

  const { data: customerUser } = await supabase
    .from('customer_users')
    .select('customer_id')
    .eq('auth_user_id', auth.userId)
    .single();

  if (!customerUser) return c.json({ customer: null });

  const { data: customer } = await supabase
    .from('customers')
    .select('id, salon_id, name, email, phone')
    .eq('id', customerUser.customer_id)
    .single();

  if (!customer || customer.salon_id !== salonId) {
    return c.json({ customer: null });
  }

  return c.json({ customer });
}

// Create or update customer profile and link to auth user
export async function upsertCustomerProfile(c: Context<{ Bindings: Env }>) {
  const auth = await verifyUser(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const salonId = body.salonId as string | undefined;
  const name = (body.name as string | undefined)?.trim();
  const phone = (body.phone as string | undefined)?.trim();

  if (!salonId || !name) return c.json({ error: 'salonId and name required' }, 400);

  const email = (auth.email || body.email || '').toLowerCase();
  if (!email) return c.json({ error: 'email required' }, 400);

  const supabase = getSupabase(c.env);

  // Ensure customer exists (unique on salon_id + email)
  const { data: existing } = await supabase
    .from('customers')
    .select('id, salon_id, name, email, phone')
    .eq('salon_id', salonId)
    .ilike('email', email)
    .single();

  let customerId = existing?.id as string | undefined;

  if (!customerId) {
    const { data: created, error } = await supabase
      .from('customers')
      .insert({ salon_id: salonId, name, email, phone: phone || null })
      .select('id, salon_id, name, email, phone')
      .single();
    if (error || !created) return c.json({ error: 'customer_create_failed' }, 500);
    customerId = created.id;
  } else {
    // Update name/phone if changed
    await supabase.from('customers')
      .update({ name, phone: phone || null })
      .eq('id', customerId);
  }

  // Link auth user to customer
  await supabase
    .from('customer_users')
    .upsert({ customer_id: customerId, auth_user_id: auth.userId }, { onConflict: 'auth_user_id' });

  const { data: customer } = await supabase
    .from('customers')
    .select('id, salon_id, name, email, phone')
    .eq('id', customerId)
    .single();

  return c.json({ customer });
}
