import type { Context } from 'hono';
import type { Env } from '../api';
import { getSupabase } from '../lib/supabase';
import { verifyAuth } from '../lib/auth';
import { logError } from '../lib/logger';
import {
  refreshGoogleToken,
  getCalendarInfo,
  getGoogleTokens,
  syncGoogleToStaffBlocks,
} from '../lib/google-calendar';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

/**
 * GET /api/google/connect?salon_id=xxx
 * Redirect salon owner to Google OAuth consent screen.
 * Requires auth (owner).
 */
export async function googleConnect(c: Context<{ Bindings: Env }>) {
  const clientId = (c.env as any).GOOGLE_CLIENT_ID;
  if (!clientId) {
    logError(c, '[Google Calendar] GOOGLE_CLIENT_ID not configured');
    return c.json({ error: 'Google Calendar not configured' }, 500);
  }

  const salonId = c.req.query('salon_id');
  if (!salonId) return c.json({ error: 'Missing salon_id' }, 400);

  // Verify the user is an owner of this salon
  const auth = await verifyAuth(c);
  if (!auth || auth.salonId !== salonId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const redirectUri = `${c.env.SITE_URL || 'https://api.bellure.nl'}/api/google/callback`;

  // Use salon_id as state parameter (same pattern as Mollie connect)
  const state = salonId;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
    access_type: 'offline',       // Required for refresh token
    prompt: 'consent',            // Force consent to always get refresh token
    include_granted_scopes: 'true',
  });

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

/**
 * GET /api/google/callback
 * Handle Google OAuth callback: exchange code for tokens, store, redirect.
 */
export async function googleCallback(c: Context<{ Bindings: Env }>) {
  const code = c.req.query('code');
  const state = c.req.query('state'); // salon_id
  const error = c.req.query('error');

  const frontendUrl = c.env.FRONTEND_URL || 'https://mijn.bellure.nl';

  if (error) {
    logError(c, '[Google Calendar] OAuth error');
    return c.redirect(`${frontendUrl}/admin/instellingen?google=error&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.redirect(`${frontendUrl}/admin/instellingen?google=error&reason=missing_params`);
  }

  const salonId = state;
  const clientId = (c.env as any).GOOGLE_CLIENT_ID;
  const clientSecret = (c.env as any).GOOGLE_CLIENT_SECRET;
  const redirectUri = `${c.env.SITE_URL || 'https://api.bellure.nl'}/api/google/callback`;

  if (!clientId || !clientSecret) {
    return c.redirect(`${frontendUrl}/admin/instellingen?google=error&reason=not_configured`);
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
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
    logError(c, '[Google Calendar] Token exchange failed', { status: tokenRes.status });
    return c.redirect(`${frontendUrl}/admin/instellingen?google=error&reason=token_exchange_failed`);
  }

  const tokenData: any = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  if (!accessToken) {
    return c.redirect(`${frontendUrl}/admin/instellingen?google=error&reason=no_access_token`);
  }

  if (!refreshToken) {
    console.warn('[Google Calendar] No refresh token received — user may have already granted access');
  }

  // Calculate token expiry
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  // Fetch primary calendar info
  const calendarInfo = await getCalendarInfo(accessToken, 'primary');
  const calendarId = calendarInfo?.id || 'primary';
  const calendarName = calendarInfo?.summary || 'Google Calendar';

  // Store tokens in salon_secrets
  const supabase = getSupabase(c.env);

  const { error: secretsErr } = await supabase.from('salon_secrets').upsert({
    salon_id: salonId,
    google_access_token: accessToken,
    google_refresh_token: refreshToken,
    google_token_expires_at: expiresAt,
    google_calendar_id: calendarId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'salon_id' });

  if (secretsErr) {
    logError(c, '[Google Calendar] Failed to store secrets', { message: secretsErr.message });
    return c.redirect(`${frontendUrl}/admin/instellingen?google=error&reason=db_error`);
  }

  // Update display fields on salons table
  const { error: salonErr } = await supabase.from('salons').update({
    google_calendar_connected_at: new Date().toISOString(),
    google_calendar_name: calendarName,
    google_calendar_sync_enabled: true,
  }).eq('id', salonId);

  if (salonErr) {
    logError(c, '[Google Calendar] Failed to update salon', { message: salonErr.message });
  }

  return c.redirect(`${frontendUrl}/admin/instellingen?google=connected`);
}

/**
 * POST /api/google/disconnect
 * Revoke tokens and disconnect Google Calendar.
 * Requires auth (owner).
 */
export async function googleDisconnect(c: Context<{ Bindings: Env }>) {
  const auth = await verifyAuth(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  const { salonId } = await c.req.json().catch(() => ({ salonId: auth.salonId }));
  if (auth.salonId !== salonId) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase(c.env);

  // Fetch current tokens to revoke
  const { data: secrets } = await supabase
    .from('salon_secrets')
    .select('google_access_token')
    .eq('salon_id', salonId)
    .single();

  // Revoke token at Google (best-effort)
  if (secrets?.google_access_token) {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${secrets.google_access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      logError(c, '[Google Calendar] Revoke error', { message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Clear Google tokens from salon_secrets
  await supabase.from('salon_secrets').update({
    google_access_token: null,
    google_refresh_token: null,
    google_token_expires_at: null,
    google_calendar_id: null,
    updated_at: new Date().toISOString(),
  }).eq('salon_id', salonId);

  // Clear display fields from salons
  await supabase.from('salons').update({
    google_calendar_connected_at: null,
    google_calendar_name: null,
    google_calendar_sync_enabled: null,
    google_calendar_last_sync_at: null,
  }).eq('id', salonId);

  // Clear google_event_id from bookings
  await supabase.from('bookings')
    .update({ google_event_id: null })
    .eq('salon_id', salonId)
    .not('google_event_id', 'is', null);

  // Delete Google-sourced staff blocks
  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('salon_id', salonId);

  if (staff && staff.length > 0) {
    await supabase.from('staff_blocks')
      .delete()
      .eq('source', 'google')
      .in('staff_id', staff.map(s => s.id));
  }

  return c.json({ success: true });
}

/**
 * GET /api/google/status?salon_id=xxx
 * Return Google Calendar connection status.
 * Requires auth.
 */
export async function googleStatus(c: Context<{ Bindings: Env }>) {
  const auth = await verifyAuth(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  const salonId = c.req.query('salon_id') || auth.salonId;

  const supabase = getSupabase(c.env);

  const { data: salon } = await supabase
    .from('salons')
    .select('google_calendar_connected_at, google_calendar_name, google_calendar_sync_enabled, google_calendar_last_sync_at')
    .eq('id', salonId)
    .single();

  if (!salon) return c.json({ error: 'Salon not found' }, 404);

  return c.json({
    connected: !!salon.google_calendar_connected_at,
    calendarName: salon.google_calendar_name || null,
    syncEnabled: salon.google_calendar_sync_enabled ?? true,
    lastSyncAt: salon.google_calendar_last_sync_at || null,
    connectedAt: salon.google_calendar_connected_at || null,
  });
}

/**
 * POST /api/google/sync-toggle
 * Enable/disable 2-way sync.
 * Requires auth (owner).
 */
export async function googleSyncToggle(c: Context<{ Bindings: Env }>) {
  const auth = await verifyAuth(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  const { enabled } = await c.req.json();
  if (typeof enabled !== 'boolean') return c.json({ error: 'Missing enabled' }, 400);

  const supabase = getSupabase(c.env);
  await supabase.from('salons').update({
    google_calendar_sync_enabled: enabled,
  }).eq('id', auth.salonId);

  return c.json({ success: true, syncEnabled: enabled });
}

/**
 * POST /api/google/webhook
 * Google Calendar push notification endpoint.
 * Triggers incremental sync when calendar changes.
 */
export async function googleWebhook(c: Context<{ Bindings: Env }>) {
  // Google sends channel info in headers
  const channelId = c.req.header('X-Goog-Channel-ID');
  const resourceState = c.req.header('X-Goog-Resource-State');

  // Validate this is a real notification (not sync verification)
  if (resourceState === 'sync') {
    return c.text('OK'); // Initial sync verification
  }

  if (!channelId) {
    return c.text('Missing channel ID', 400);
  }

  // The channelId format is: gcal-{salonId}
  const salonId = channelId.startsWith('gcal-') ? channelId.slice(5) : null;
  if (!salonId) {
    return c.text('Invalid channel ID', 400);
  }

  // Trigger sync for this salon (non-blocking)
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const tokens = await getGoogleTokens(c.env, salonId);
        if (!tokens) return;

        const result = await syncGoogleToStaffBlocks(c.env, salonId, tokens);
        console.log(`[Google Calendar] Webhook sync for ${salonId}:`, result);
      } catch (err) {
        logError(undefined, `[Google Calendar] Webhook sync error`, { salonId, message: err instanceof Error ? err.message : String(err) });
      }
    })()
  );

  return c.text('OK');
}
