import type { Env } from '../api';
import { getSupabase } from './supabase';

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Token buffer: refresh if less than 5 minutes until expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
  calendarId: string;
}

interface BookingData {
  id: string;
  start_at: string;
  end_at: string;
  customer_name: string;
  customer_phone?: string;
}

interface SalonData {
  name: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
}

/**
 * Get Google Calendar tokens for a salon, refreshing if needed.
 * Returns null if not connected.
 */
export async function getGoogleTokens(
  env: Env,
  salonId: string
): Promise<GoogleTokens | null> {
  const supabase = getSupabase(env);

  const { data: secrets } = await supabase
    .from('salon_secrets')
    .select('google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id')
    .eq('salon_id', salonId)
    .single();

  if (!secrets?.google_access_token || !secrets?.google_refresh_token) {
    return null;
  }

  // Check if token needs refresh
  const expiresAt = secrets.google_token_expires_at
    ? new Date(secrets.google_token_expires_at).getTime()
    : 0;
  const now = Date.now();

  if (expiresAt - now < TOKEN_REFRESH_BUFFER_MS) {
    const newAccessToken = await refreshGoogleToken(env, salonId, secrets.google_refresh_token);
    if (!newAccessToken) {
      console.error(`[Google Calendar] Token refresh failed for salon ${salonId}`);
      return null;
    }
    return {
      accessToken: newAccessToken,
      refreshToken: secrets.google_refresh_token,
      expiresAt: null,
      calendarId: secrets.google_calendar_id || 'primary',
    };
  }

  return {
    accessToken: secrets.google_access_token,
    refreshToken: secrets.google_refresh_token,
    expiresAt: secrets.google_token_expires_at,
    calendarId: secrets.google_calendar_id || 'primary',
  };
}

/**
 * Refresh an expired Google access token using the refresh token.
 * Returns the new access token or null on failure.
 */
export async function refreshGoogleToken(
  env: Env,
  salonId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = (env as any).GOOGLE_CLIENT_ID;
  const clientSecret = (env as any).GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Google Calendar] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured');
    return null;
  }

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Google Calendar] Token refresh failed: ${res.status}`, errBody);
      return null;
    }

    const data: any = await res.json();
    if (!data.access_token) return null;

    // Calculate expiry (Google tokens expire in ~3600 seconds)
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

    // Update stored tokens
    const supabase = getSupabase(env);
    await supabase.from('salon_secrets').update({
      google_access_token: data.access_token,
      google_token_expires_at: expiresAt,
      // Google may issue a new refresh token
      ...(data.refresh_token ? { google_refresh_token: data.refresh_token } : {}),
      updated_at: new Date().toISOString(),
    }).eq('salon_id', salonId);

    return data.access_token;
  } catch (err) {
    console.error('[Google Calendar] Token refresh error:', err);
    return null;
  }
}

/**
 * Build a full address string for event location.
 */
function buildLocation(salon: SalonData): string {
  const parts = [salon.address, salon.postal_code, salon.city].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : salon.name;
}

/**
 * Create a Google Calendar event for a booking.
 * Returns the Google event ID.
 */
export async function createGoogleEvent(
  tokens: GoogleTokens,
  booking: BookingData,
  salon: SalonData,
  serviceNames: string[],
  totalPriceCents: number
): Promise<string | null> {
  const title = `Boeking: ${booking.customer_name} - ${serviceNames.join(', ')}`;
  const description = [
    `Diensten: ${serviceNames.join(', ')}`,
    `Prijs: €${(totalPriceCents / 100).toFixed(2).replace('.', ',')}`,
    booking.customer_phone ? `Telefoon: ${booking.customer_phone}` : null,
    '',
    'Aangemaakt via Bellure Booking',
  ].filter(v => v !== null).join('\n');

  const event = {
    summary: title,
    location: buildLocation(salon),
    description,
    start: {
      dateTime: booking.start_at,
      timeZone: 'Europe/Amsterdam',
    },
    end: {
      dateTime: booking.end_at,
      timeZone: 'Europe/Amsterdam',
    },
    // Use extended properties to tag Bellure events
    extendedProperties: {
      private: {
        bellure_booking_id: booking.id,
        source: 'bellure',
      },
    },
  };

  try {
    const res = await fetch(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Google Calendar] Create event failed: ${res.status}`, errBody);
      return null;
    }

    const created: any = await res.json();
    return created.id || null;
  } catch (err) {
    console.error('[Google Calendar] Create event error:', err);
    return null;
  }
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateGoogleEvent(
  tokens: GoogleTokens,
  eventId: string,
  booking: BookingData,
  salon: SalonData,
  serviceNames: string[],
  totalPriceCents: number
): Promise<void> {
  const title = `Boeking: ${booking.customer_name} - ${serviceNames.join(', ')}`;
  const description = [
    `Diensten: ${serviceNames.join(', ')}`,
    `Prijs: €${(totalPriceCents / 100).toFixed(2).replace('.', ',')}`,
    booking.customer_phone ? `Telefoon: ${booking.customer_phone}` : null,
    '',
    'Aangemaakt via Bellure Booking',
  ].filter(v => v !== null).join('\n');

  const event = {
    summary: title,
    location: buildLocation(salon),
    description,
    start: {
      dateTime: booking.start_at,
      timeZone: 'Europe/Amsterdam',
    },
    end: {
      dateTime: booking.end_at,
      timeZone: 'Europe/Amsterdam',
    },
  };

  try {
    const res = await fetch(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!res.ok) {
      console.error(`[Google Calendar] Update event failed: ${res.status}`);
    }
  } catch (err) {
    console.error('[Google Calendar] Update event error:', err);
  }
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteGoogleEvent(
  tokens: GoogleTokens,
  eventId: string
): Promise<void> {
  try {
    const res = await fetch(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
      }
    );

    // 410 Gone is fine — event already deleted
    if (!res.ok && res.status !== 410) {
      console.error(`[Google Calendar] Delete event failed: ${res.status}`);
    }
  } catch (err) {
    console.error('[Google Calendar] Delete event error:', err);
  }
}

/**
 * List events from Google Calendar within a time range.
 * Used for Google → Bellure sync (staff blocks).
 */
export async function listGoogleEvents(
  tokens: GoogleTokens,
  timeMin: string,
  timeMax: string
): Promise<any[]> {
  const events: any[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(
        `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/events?${params}`,
        {
          headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
        }
      );

      if (!res.ok) {
        console.error(`[Google Calendar] List events failed: ${res.status}`);
        break;
      }

      const data: any = await res.json();
      events.push(...(data.items || []));
      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.error('[Google Calendar] List events error:', err);
  }

  return events;
}

/**
 * Set up a push notification channel (webhook) for calendar changes.
 */
export async function watchCalendar(
  tokens: GoogleTokens,
  webhookUrl: string,
  channelId: string,
  expiration: number // Unix timestamp in ms
): Promise<any> {
  try {
    const res = await fetch(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/events/watch`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          expiration,
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Google Calendar] Watch setup failed: ${res.status}`, errBody);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('[Google Calendar] Watch error:', err);
    return null;
  }
}

/**
 * Fetch calendar metadata (name, etc).
 */
export async function getCalendarInfo(
  accessToken: string,
  calendarId: string = 'primary'
): Promise<{ id: string; summary: string } | null> {
  try {
    const res = await fetch(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) return null;
    const data: any = await res.json();
    return { id: data.id, summary: data.summary };
  } catch {
    return null;
  }
}

/**
 * Sync Google Calendar events → staff blocks for a single salon.
 * Filters out events created by Bellure (via extended properties).
 */
export async function syncGoogleToStaffBlocks(
  env: Env,
  salonId: string,
  tokens: GoogleTokens
): Promise<{ created: number; deleted: number; updated: number }> {
  const supabase = getSupabase(env);
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 4 * 7 * 24 * 3600000).toISOString(); // 4 weeks ahead

  const events = await listGoogleEvents(tokens, timeMin, timeMax);

  // Filter out Bellure-created events (don't create blocks for our own bookings)
  const externalEvents = events.filter(e => {
    const bellureId = e.extendedProperties?.private?.source;
    return bellureId !== 'bellure';
  });

  // Get existing Google-sourced blocks for this salon
  // We need staff IDs — for now, use the first active staff member as the default
  const { data: staffMembers } = await supabase
    .from('staff')
    .select('id')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('sort_order')
    .limit(1);

  const defaultStaffId = staffMembers?.[0]?.id;
  if (!defaultStaffId) {
    console.log(`[Google Calendar] No active staff for salon ${salonId}, skipping sync`);
    return { created: 0, deleted: 0, updated: 0 };
  }

  const { data: existingBlocks } = await supabase
    .from('staff_blocks')
    .select('id, google_event_id, start_at, end_at, staff_id')
    .eq('source', 'google')
    .in('staff_id', (staffMembers || []).map(s => s.id));

  const existingMap = new Map(
    (existingBlocks || []).map(b => [b.google_event_id, b])
  );

  const googleEventIds = new Set(externalEvents.map(e => e.id));
  let created = 0;
  let deleted = 0;
  let updated = 0;

  // Create or update blocks for external events
  for (const event of externalEvents) {
    // Skip all-day events (no dateTime)
    if (!event.start?.dateTime || !event.end?.dateTime) continue;

    const existing = existingMap.get(event.id);

    if (existing) {
      // Check if times changed
      if (existing.start_at !== event.start.dateTime || existing.end_at !== event.end.dateTime) {
        await supabase.from('staff_blocks').update({
          start_at: event.start.dateTime,
          end_at: event.end.dateTime,
          reason: event.summary || 'Google Calendar',
        }).eq('id', existing.id);
        updated++;
      }
    } else {
      // Create new block
      await supabase.from('staff_blocks').insert({
        staff_id: defaultStaffId,
        start_at: event.start.dateTime,
        end_at: event.end.dateTime,
        reason: event.summary || 'Google Calendar',
        google_event_id: event.id,
        source: 'google',
      });
      created++;
    }
  }

  // Delete blocks for events that no longer exist in Google
  for (const block of (existingBlocks || [])) {
    if (block.google_event_id && !googleEventIds.has(block.google_event_id)) {
      await supabase.from('staff_blocks').delete().eq('id', block.id);
      deleted++;
    }
  }

  // Update last sync timestamp
  await supabase.from('salons').update({
    google_calendar_last_sync_at: new Date().toISOString(),
  }).eq('id', salonId);

  return { created, deleted, updated };
}

/**
 * Sync helper: create Google event for a confirmed booking.
 * Non-blocking, fire-and-forget with error logging.
 */
export async function syncBookingToGoogle(
  env: Env,
  bookingId: string,
  salonId: string
): Promise<void> {
  try {
    const tokens = await getGoogleTokens(env, salonId);
    if (!tokens) return; // Not connected, skip silently

    const supabase = getSupabase(env);

    // Check if sync is enabled
    const { data: salon } = await supabase
      .from('salons')
      .select('name, address, city, postal_code, google_calendar_sync_enabled')
      .eq('id', salonId)
      .single();

    if (!salon?.google_calendar_sync_enabled) return;

    // Fetch booking with services
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, start_at, end_at, customer_name, customer_phone, amount_total_cents')
      .eq('id', bookingId)
      .single();

    if (!booking) return;

    // Fetch service names
    const { data: bookingServices } = await supabase
      .from('booking_services')
      .select('service_id, services:service_id(name)')
      .eq('booking_id', bookingId);

    const serviceNames = (bookingServices || []).map(
      (bs: any) => bs.services?.name || 'Onbekend'
    );

    if (serviceNames.length === 0) {
      // Fallback: use notes or single service
      const { data: bk } = await supabase
        .from('bookings')
        .select('notes, service_id, services:service_id(name)')
        .eq('id', bookingId)
        .single();
      if (bk) {
        serviceNames.push((bk as any).services?.name || bk.notes || 'Behandeling');
      }
    }

    const eventId = await createGoogleEvent(
      tokens,
      booking,
      salon,
      serviceNames,
      booking.amount_total_cents || 0
    );

    if (eventId) {
      await supabase.from('bookings').update({ google_event_id: eventId }).eq('id', bookingId);
      console.log(`[Google Calendar] Created event ${eventId} for booking ${bookingId}`);
    }
  } catch (err) {
    console.error(`[Google Calendar] syncBookingToGoogle error:`, err);
  }
}

/**
 * Delete Google event for a cancelled booking.
 */
export async function deleteBookingFromGoogle(
  env: Env,
  bookingId: string,
  salonId: string
): Promise<void> {
  try {
    const tokens = await getGoogleTokens(env, salonId);
    if (!tokens) return;

    const supabase = getSupabase(env);

    const { data: booking } = await supabase
      .from('bookings')
      .select('google_event_id')
      .eq('id', bookingId)
      .single();

    if (!booking?.google_event_id) return;

    await deleteGoogleEvent(tokens, booking.google_event_id);

    // Clear the google_event_id
    await supabase.from('bookings').update({ google_event_id: null }).eq('id', bookingId);
    console.log(`[Google Calendar] Deleted event for booking ${bookingId}`);
  } catch (err) {
    console.error(`[Google Calendar] deleteBookingFromGoogle error:`, err);
  }
}
