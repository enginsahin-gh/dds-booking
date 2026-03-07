import { logError } from './logger';
import type { Env } from '../api';
import { getSupabase } from './supabase';

/**
 * Insert an audit log entry (non-blocking when used with waitUntil).
 */
export async function logAudit(env: Env, params: {
  salonId: string;
  action: string;
  actorType?: 'user' | 'system' | 'webhook' | 'cron';
  actorId?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    const supabase = getSupabase(env);
    await supabase.from('audit_logs').insert({
      salon_id: params.salonId,
      action: params.action,
      actor_type: params.actorType || 'system',
      actor_id: params.actorId,
      target_type: params.targetType,
      target_id: params.targetId,
      details: params.details,
      ip_address: params.ip,
    });
  } catch (err) {
    logError(undefined, 'Audit log insert error');
  }
}
