import { logError } from '../lib/logger';
import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { verifyAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';

const MOLLIE_AUTH_URL = 'https://my.mollie.com/oauth2/authorize';
const MOLLIE_TOKEN_URL = 'https://api.mollie.com/oauth2/tokens';
const MOLLIE_API_BASE = 'https://api.mollie.com/v2';

// Minimal scopes — only what's strictly needed (AVG/privacy-first)
const SCOPES = [
  'payments.write',   // Create payments when customer books
  'refunds.write',    // Process refunds on cancellation
  'profiles.read',    // Required to link payments to correct Mollie profile
].join(' ');

/**
 * Step 1: Redirect salon admin to Mollie OAuth authorize page.
 * GET /api/mollie/connect?salon_id=xxx
 * SEC-004: Requires owner authentication.
 * SEC-005: Generates a signed state token with nonce and expiry for CSRF protection.
 */
export async function mollieConnect(c: Context<{ Bindings: Env }>) {
  // SEC-004: Require owner authentication
  const owner = await verifyAuth(c);
  if (!owner) return c.text('Unauthorized', 401);

  const salonId = c.req.query('salon_id');
  if (!salonId) return c.text('Missing salon_id', 400);

  // Verify the salon belongs to the authenticated owner
  if (salonId !== owner.salonId) return c.text('Unauthorized', 403);

  const clientId = c.env.MOLLIE_APP_ID;
  if (!clientId) return c.text('Mollie Connect not configured', 500);

  const redirectUri = `${c.env.SITE_URL || 'https://api.bellure.nl'}/api/mollie/callback`;

  // SEC-005: Generate signed state token with nonce and expiry (10 min)
  const state = btoa(JSON.stringify({
    salonId,
    nonce: crypto.randomUUID(),
    exp: Date.now() + 600000,
  }));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
    approval_prompt: 'force',
  });

  return c.redirect(`${MOLLIE_AUTH_URL}?${params.toString()}`);
}

/**
 * Step 2: Handle Mollie OAuth callback.
 * GET /api/mollie/callback?code=xxx&state=signed_token
 * SEC-005: Verifies the signed state token (expiry + nonce).
 */
export async function mollieCallback(c: Context<{ Bindings: Env }>) {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  const frontendUrl = c.env.FRONTEND_URL || 'https://mijn.bellure.nl';

  if (error) {
    logError(c, 'Mollie OAuth error');
    return c.redirect(`${frontendUrl}/admin/payments?mollie=error&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.redirect(`${frontendUrl}/admin/payments?mollie=error&reason=missing_params`);
  }

  // SEC-005: Verify the signed state token
  let salonId: string;
  try {
    const stateData = JSON.parse(atob(state));
    if (!stateData.salonId || !stateData.nonce || !stateData.exp) {
      return c.redirect(`${frontendUrl}/admin/payments?mollie=error&reason=invalid_state`);
    }
    if (Date.now() > stateData.exp) {
      return c.redirect(`${frontendUrl}/admin/payments?mollie=error&reason=state_expired`);
    }
    salonId = stateData.salonId;
  } catch {
    return c.redirect(`${frontendUrl}/admin/payments?mollie=error&reason=invalid_state`);
  }
  const clientId = c.env.MOLLIE_APP_ID;
  const clientSecret = c.env.MOLLIE_APP_SECRET;
  const redirectUri = `${c.env.SITE_URL || 'https://api.bellure.nl'}/api/mollie/callback`;

  if (!clientId || !clientSecret) {
    return c.redirect(`${frontendUrl}/admin/payments?mollie=error&reason=not_configured`);
  }

  // Exchange authorization code for access token
  const tokenRes = await fetch(MOLLIE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    logError(c, 'Mollie token exchange failed', { status: tokenRes.status });
    return c.redirect(`${frontendUrl}/admin/payments?mollie=error&reason=token_exchange_failed`);
  }

  const tokenData: any = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  if (!accessToken) {
    return c.redirect(`${frontendUrl}/admin/payments?mollie=error&reason=no_access_token`);
  }

  // Fetch Mollie organization info
  let organizationId = null;
  let organizationName = null;
  try {
    const orgRes = await fetch(`${MOLLIE_API_BASE}/organizations/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (orgRes.ok) {
      const org: any = await orgRes.json();
      organizationId = org.id;
      organizationName = org.name || null;
    }
  } catch (err) {
    logError(c, 'Failed to fetch Mollie org');
  }

  // Fetch first profile ID
  let profileId = null;
  try {
    const profileRes = await fetch(`${MOLLIE_API_BASE}/profiles?limit=1`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (profileRes.ok) {
      const profiles: any = await profileRes.json();
      if (profiles._embedded?.profiles?.length > 0) {
        profileId = profiles._embedded.profiles[0].id;
      }
    }
  } catch (err) {
    logError(c, 'Failed to fetch Mollie profiles');
  }

  // Store tokens in salon_secrets (sensitive) and display data in salons (non-sensitive)
  const supabase = getSupabase(c.env);

  const { error: secretsErr } = await supabase.from('salon_secrets').upsert({
    salon_id: salonId,
    mollie_access_token: accessToken,
    mollie_refresh_token: refreshToken,
    mollie_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const { error: dbErr } = await supabase.from('salons').update({
    mollie_profile_id: profileId,
    mollie_organization_id: organizationId,
    mollie_organization_name: organizationName,
    mollie_connected_at: new Date().toISOString(),
  }).eq('id', salonId);

  if (secretsErr) {
    logError(c, 'Failed to store Mollie secrets');
  }

  if (dbErr) {
    logError(c, 'Failed to store Mollie tokens');
    return c.redirect(`${frontendUrl}/admin/payments?mollie=error&reason=db_error`);
  }

  // Audit log: Mollie connected (non-blocking)
  c.executionCtx.waitUntil(
    logAudit(c.env, {
      salonId,
      action: 'mollie.connect',
      actorType: 'system',
      targetType: 'salon',
      targetId: salonId,
      details: { organizationId, organizationName },
      ip: c.req.header('cf-connecting-ip') || undefined,
    })
  );

  return c.redirect(`${frontendUrl}/admin/payments?mollie=success`);
}

/**
 * Disconnect Mollie account from salon.
 * POST /api/mollie/disconnect { salonId }
 * SEC-004: Requires owner authentication.
 */
export async function mollieDisconnect(c: Context<{ Bindings: Env }>) {
  // SEC-004: Require owner authentication
  const owner = await verifyAuth(c);
  if (!owner) return c.json({ error: 'Unauthorized' }, 401);

  const { salonId } = await c.req.json();
  if (!salonId) return c.json({ error: 'Missing salonId' }, 400);

  // Verify the salon belongs to the authenticated owner
  if (salonId !== owner.salonId) return c.json({ error: 'Unauthorized' }, 403);

  const supabase = getSupabase(c.env);
  await supabase.from('salon_secrets').delete().eq('salon_id', salonId);
  await supabase.from('salons').update({
    mollie_profile_id: null,
    mollie_organization_id: null,
    mollie_organization_name: null,
    mollie_connected_at: null,
  }).eq('id', salonId);

  // Audit log: Mollie disconnected (non-blocking)
  c.executionCtx.waitUntil(
    logAudit(c.env, {
      salonId,
      action: 'mollie.disconnect',
      actorType: 'user',
      actorId: owner.userId,
      targetType: 'salon',
      targetId: salonId,
      ip: c.req.header('cf-connecting-ip') || undefined,
    })
  );

  return c.json({ success: true });
}

/**
 * Refresh an expired Mollie access token using the refresh token.
 * Returns the new access token or null on failure.
 */
export async function refreshMollieToken(
  env: Env,
  salonId: string,
  refreshToken: string
): Promise<string | null> {
  const tokenRes = await fetch(MOLLIE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.MOLLIE_APP_ID,
      client_secret: env.MOLLIE_APP_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    logError(undefined, 'Mollie token refresh failed');
    return null;
  }

  const data: any = await tokenRes.json();
  if (!data.access_token) return null;

  // Update stored tokens in salon_secrets
  const supabase = getSupabase(env);
  await supabase.from('salon_secrets').upsert({
    salon_id: salonId,
    mollie_access_token: data.access_token,
    mollie_refresh_token: data.refresh_token || refreshToken,
    updated_at: new Date().toISOString(),
  });

  return data.access_token;
}
