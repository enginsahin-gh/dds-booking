import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from './supabase';

/**
 * Verify the request is from an authenticated salon owner.
 * Parses Bearer JWT, decodes user_id from payload, looks up salon_users.
 * Returns { userId, salonId } or null if unauthorized.
 */
export async function verifyAuth(
  c: Context<{ Bindings: Env }>
): Promise<{ userId: string; salonId: string } | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub;
    if (!userId) return null;

    const supabase = getSupabase(c.env);

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
