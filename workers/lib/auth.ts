import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from './supabase';

/**
 * Verify the request is from an authenticated salon owner.
 * Uses Supabase auth.getUser() for server-side JWT signature verification,
 * then looks up salon_users to confirm owner role.
 * Returns { userId, salonId } or null if unauthorized.
 */
export async function verifyAuth(
  c: Context<{ Bindings: Env }>
): Promise<{ userId: string; salonId: string } | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  try {
    const supabase = getSupabase(c.env);

    // Server-side JWT signature verification via Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const userId = user.id;

    const { data: salonUser } = await supabase
      .from('salon_users')
      .select('salon_id, role')
      .eq('user_id', userId)
      .eq('role', 'owner')
      .single();

    if (!salonUser) return null;

    return { userId, salonId: salonUser.salon_id };
  } catch {
    return null;
  }
}

/**
 * Verify any authenticated user (no owner role required).
 * Returns { userId, email } or null if unauthorized.
 */
export async function verifyUser(
  c: Context<{ Bindings: Env }>
): Promise<{ userId: string; email: string | null } | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  try {
    const supabase = getSupabase(c.env);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    return { userId: user.id, email: user.email || null };
  } catch {
    return null;
  }
}
