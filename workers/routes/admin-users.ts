import { logError } from '../lib/logger';
import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { createClient } from '@supabase/supabase-js';

// Simple in-memory rate limiter (per-isolate, resets on deploy)
// Limits admin endpoints to 30 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(c: Context): boolean {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const now = Date.now();

  // Lazy cleanup: remove expired entries when map grows too large
  if (rateLimitMap.size > 1000) {
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return false;
  return true;
}

/** Verify the request is from an authenticated salon owner */
async function verifyOwner(c: Context<{ Bindings: Env }>) {
  if (!checkRateLimit(c)) {
    return null; // Rate limited — treated as unauthorized
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  // Use service role to look up the user's salon_users record
  const supabase = getSupabase(c.env);
  
  // SEC-013: Server-side JWT signature verification via Supabase
  try {
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
 * POST /api/admin/invite-user
 * Body: { email, name, role, staffId? }
 * Auth: Bearer token of salon owner
 */
export async function inviteUser(c: Context<{ Bindings: Env }>) {
  const owner = await verifyOwner(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const { email, name, role, staffId } = await c.req.json();
  
  if (!email || !name || !role) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  if (!['owner', 'staff'].includes(role)) {
    return c.json({ error: 'Invalid role' }, 400);
  }

  const supabase = getSupabase(c.env);

  // Check if email already has an account in this salon
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === email);

  if (existingUser) {
    // Check if already linked to this salon
    const { data: existingLink } = await supabase
      .from('salon_users')
      .select('id')
      .eq('salon_id', owner.salonId)
      .eq('user_id', existingUser.id)
      .single();

    if (existingLink) {
      return c.json({ error: 'Dit e-mailadres is al gekoppeld aan deze salon' }, 400);
    }
  }

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create new auth user with a random password (they'll set their own via invite link)
    const tempPassword = crypto.randomUUID() + '!Aa1';
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: name },
    });

    if (createErr || !newUser?.user) {
      logError(c, 'Failed to create user', { message: createErr?.message });
      return c.json({ error: 'Kon account niet aanmaken' }, 500);
    }

    userId = newUser.user.id;
  }

  // Create salon_users record
  const { error: linkErr } = await supabase.from('salon_users').insert({
    salon_id: owner.salonId,
    user_id: userId,
    staff_id: staffId || null,
    role,
    display_name: name,
    invited_by: owner.userId,
  });

  if (linkErr) {
    logError(c, 'Failed to create salon_user', { message: linkErr.message });
    return c.json({ error: 'Kon gebruiker niet koppelen aan salon' }, 500);
  }

  // Generate password setup link — uses 'recovery' type since user is already email_confirmed
  const { data: linkData, error: linkGenErr } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${c.env.FRONTEND_URL || 'https://mijn.bellure.nl'}/admin/set-password`,
    },
  });

  if (linkGenErr || !linkData) {
    logError(c, 'Failed to generate setup link', { message: linkGenErr?.message });
    // User is created but link failed — they can use password reset from login page
    return c.json({ success: true, userId, inviteSent: false });
  }

  // Send invitation email via Resend
  const inviteLink = linkData.properties?.action_link;
  
  // Get salon name
  const { data: salon } = await supabase.from('salons').select('name').eq('id', owner.salonId).single();
  const salonName = salon?.name || 'de salon';

  const roleLabel = role === 'owner' ? 'eigenaar' : 'medewerker';

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${salonName} <noreply@bellure.nl>`,
        to: email,
        subject: `Je bent uitgenodigd voor ${salonName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1E293B; margin-bottom: 8px;">Welkom bij ${salonName}!</h2>
            <p style="color: #475569; line-height: 1.6;">
              Hoi ${name},<br><br>
              Je bent uitgenodigd als <strong>${roleLabel}</strong> voor ${salonName}. 
              Klik op de knop hieronder om je wachtwoord in te stellen. Daarna kun je direct inloggen.
            </p>
            <div style="margin: 24px 0;">
              <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #7C3AED; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                Wachtwoord instellen
              </a>
            </div>
            <p style="color: #94A3B8; font-size: 13px; line-height: 1.5;">
              Deze link is 24 uur geldig. Na het instellen van je wachtwoord kun je inloggen via <a href="${c.env.FRONTEND_URL || 'https://mijn.bellure.nl'}/admin/login" style="color: #7C3AED;">mijn.bellure.nl</a>.
            </p>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
            <p style="color: #CBD5E1; font-size: 11px;">
              Powered by Bellure
            </p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      logError(c, 'Resend error');
      return c.json({ success: true, userId, inviteSent: false });
    }
  } catch (err) {
    logError(c, 'Email send error', { message: err instanceof Error ? err.message : String(err) });
    return c.json({ success: true, userId, inviteSent: false });
  }

  // Audit log: user invited (non-blocking)
  c.executionCtx.waitUntil(
    logAudit(c.env, {
      salonId: owner.salonId,
      action: 'user.invite',
      actorType: 'user',
      actorId: owner.userId,
      targetType: 'user',
      targetId: userId,
      details: { email, role },
      ip: c.req.header('cf-connecting-ip') || undefined,
    })
  );

  return c.json({ success: true, userId, inviteSent: true });
}

/**
 * POST /api/admin/remove-user
 * Body: { userId }
 * Auth: Bearer token of salon owner
 */
export async function removeUser(c: Context<{ Bindings: Env }>) {
  const owner = await verifyOwner(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const { userId } = await c.req.json();
  if (!userId) return c.json({ error: 'Missing userId' }, 400);

  // Can't remove yourself
  if (userId === owner.userId) {
    return c.json({ error: 'Je kunt jezelf niet verwijderen' }, 400);
  }

  const supabase = getSupabase(c.env);

  // Verify user belongs to this salon
  const { data: targetUser } = await supabase
    .from('salon_users')
    .select('id, role')
    .eq('salon_id', owner.salonId)
    .eq('user_id', userId)
    .single();

  if (!targetUser) {
    return c.json({ error: 'Gebruiker niet gevonden' }, 404);
  }

  // If removing an owner, check there's at least one other owner
  if (targetUser.role === 'owner') {
    const { count } = await supabase
      .from('salon_users')
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', owner.salonId)
      .eq('role', 'owner');

    if ((count || 0) <= 1) {
      return c.json({ error: 'Er moet minimaal één eigenaar overblijven' }, 400);
    }
  }

  // Remove salon_users record
  await supabase.from('salon_users').delete().eq('id', targetUser.id);

  // Check if user has links to other salons — if not, delete the auth user entirely
  const { count: otherLinks } = await supabase
    .from('salon_users')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((otherLinks || 0) === 0) {
    await supabase.auth.admin.deleteUser(userId);
  }

  // Audit log: user removed (non-blocking)
  c.executionCtx.waitUntil(
    logAudit(c.env, {
      salonId: owner.salonId,
      action: 'user.remove',
      actorType: 'user',
      actorId: owner.userId,
      targetType: 'user',
      targetId: userId,
      details: { removedRole: targetUser.role },
      ip: c.req.header('cf-connecting-ip') || undefined,
    })
  );

  return c.json({ success: true });
}

/**
 * POST /api/admin/update-user-role
 * Body: { userId, role }
 * Auth: Bearer token of salon owner
 */
export async function updateUserRole(c: Context<{ Bindings: Env }>) {
  const owner = await verifyOwner(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const { userId, role } = await c.req.json();
  if (!userId || !role) return c.json({ error: 'Missing fields' }, 400);
  if (!['owner', 'staff'].includes(role)) return c.json({ error: 'Invalid role' }, 400);

  const supabase = getSupabase(c.env);

  // Get current record
  const { data: targetUser } = await supabase
    .from('salon_users')
    .select('id, role')
    .eq('salon_id', owner.salonId)
    .eq('user_id', userId)
    .single();

  if (!targetUser) return c.json({ error: 'Gebruiker niet gevonden' }, 404);

  // If demoting from owner, check there's at least one other owner
  if (targetUser.role === 'owner' && role === 'staff') {
    const { count } = await supabase
      .from('salon_users')
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', owner.salonId)
      .eq('role', 'owner');

    if ((count || 0) <= 1) {
      return c.json({ error: 'Er moet minimaal één eigenaar overblijven' }, 400);
    }
  }

  await supabase.from('salon_users').update({ role }).eq('id', targetUser.id);

  // Audit log: role changed (non-blocking)
  c.executionCtx.waitUntil(
    logAudit(c.env, {
      salonId: owner.salonId,
      action: 'user.role_change',
      actorType: 'user',
      actorId: owner.userId,
      targetType: 'user',
      targetId: userId,
      details: { previousRole: targetUser.role, newRole: role },
      ip: c.req.header('cf-connecting-ip') || undefined,
    })
  );

  return c.json({ success: true });
}

/**
 * POST /api/admin/update-user-permissions
 * Body: { userId, readScope, editScope, readableStaffIds?, editableStaffIds?, canSeeRevenue? }
 * Auth: Bearer token of salon owner
 */
export async function updateUserPermissions(c: Context<{ Bindings: Env }>) {
  const owner = await verifyOwner(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const { userId, readScope, editScope, readableStaffIds, editableStaffIds, canSeeRevenue } = await c.req.json();
  if (!userId) return c.json({ error: 'Missing userId' }, 400);

  const validScopes = ['all', 'specific', 'self'];
  if (readScope && !validScopes.includes(readScope)) return c.json({ error: 'Invalid readScope' }, 400);
  if (editScope && !validScopes.includes(editScope)) return c.json({ error: 'Invalid editScope' }, 400);

  // Validate: edit scope cannot exceed read scope
  const scopeOrder = { self: 0, specific: 1, all: 2 };
  const finalRead = readScope || 'self';
  const finalEdit = editScope || 'self';
  if (scopeOrder[finalEdit as keyof typeof scopeOrder] > scopeOrder[finalRead as keyof typeof scopeOrder]) {
    return c.json({ error: 'Bewerkrechten kunnen niet breder zijn dan inzagerechten' }, 400);
  }

  const supabase = getSupabase(c.env);

  // Verify target user belongs to this salon and is not an owner
  const { data: targetUser } = await supabase
    .from('salon_users')
    .select('id, role')
    .eq('salon_id', owner.salonId)
    .eq('user_id', userId)
    .single();

  if (!targetUser) return c.json({ error: 'Gebruiker niet gevonden' }, 404);
  if (targetUser.role === 'owner') return c.json({ error: 'Rechten van eigenaren kunnen niet worden beperkt' }, 400);

  const update: Record<string, unknown> = {};
  if (readScope) update.read_scope = readScope;
  if (editScope) update.edit_scope = editScope;
  if (readableStaffIds !== undefined) update.readable_staff_ids = readableStaffIds || [];
  if (editableStaffIds !== undefined) update.editable_staff_ids = editableStaffIds || [];
  if (canSeeRevenue !== undefined) update.can_see_revenue = canSeeRevenue;

  const { error: updateErr } = await supabase
    .from('salon_users')
    .update(update)
    .eq('id', targetUser.id);

  if (updateErr) {
    logError(c, 'Failed to update permissions', { message: updateErr.message });
    return c.json({ error: 'Kon rechten niet bijwerken' }, 500);
  }

  return c.json({ success: true });
}

/**
 * GET /api/admin/users
 * Auth: Bearer token of salon owner
 * Returns all salon_users for the owner's salon
 */
export async function listUsers(c: Context<{ Bindings: Env }>) {
  const owner = await verifyOwner(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase(c.env);

  const { data: users } = await supabase
    .from('salon_users')
    .select('id, user_id, staff_id, role, display_name, can_see_revenue, read_scope, edit_scope, readable_staff_ids, editable_staff_ids, created_at')
    .eq('salon_id', owner.salonId)
    .order('created_at');

  // Get emails from auth
  const userIds = (users || []).map(u => u.user_id);
  const enriched = [];

  for (const su of (users || [])) {
    const { data: authData } = await supabase.auth.admin.getUserById(su.user_id);
    enriched.push({
      ...su,
      email: authData?.user?.email || null,
      last_sign_in: authData?.user?.last_sign_in_at || null,
    });
  }

  return c.json({ users: enriched });
}
