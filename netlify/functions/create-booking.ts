import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory IP rate limiting (resets on function cold start)
const ipRequests = new Map<string, { count: number; resetAt: number }>();
const IP_RATE_LIMIT = 10; // max requests per window
const IP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + IP_RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > IP_RATE_LIMIT;
}

const handler: Handler = async (event) => {
  // CORS headers for widget embeds
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // IP-based rate limiting (SEC-006)
  const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers['client-ip']
    || 'unknown';

  if (isIpRateLimited(clientIp)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'RATE_LIMITED' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { salonId, serviceId, staffId, startAt, endAt, name, email, phone, hp } = body;

    if (!salonId || !serviceId || !staffId || !startAt || !endAt || !name || !email || !phone) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Server-side honeypot check (BUG-008)
    if (hp) {
      // Silently reject — looks like success to bots
      return { statusCode: 200, headers, body: JSON.stringify({ bookingId: 'ok' }) };
    }

    // Create booking via database function (handles validation, rate limiting, conflict detection)
    const { data: bookingId, error: bookingErr } = await supabase.rpc('create_booking', {
      p_salon_id: salonId,
      p_service_id: serviceId,
      p_staff_id: staffId,
      p_start_at: startAt,
      p_end_at: endAt,
      p_name: name,
      p_email: email,
      p_phone: phone,
      p_hp: hp || '',
    });

    if (bookingErr) {
      const msg = bookingErr.message || '';
      if (msg.includes('SLOT_TAKEN')) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'SLOT_TAKEN' }) };
      }
      if (msg.includes('RATE_LIMITED')) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'RATE_LIMITED' }) };
      }
      if (msg.includes('SPAM_DETECTED')) {
        return { statusCode: 200, headers, body: JSON.stringify({ bookingId: 'ok' }) };
      }
      if (msg.includes('INVALID_')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: msg }) };
      }
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Booking failed' }) };
    }

    // Trigger emails server-side (SEC-007: secret never exposed to client)
    const emailSecret = process.env.EMAIL_SECRET;
    const emailBaseUrl = process.env.URL || 'https://boeken.ensalabs.nl';

    const sendEmail = async (type: string) => {
      try {
        // Internal call to send-email function with secret
        const res = await fetch(`${emailBaseUrl}/.netlify/functions/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-email-secret': emailSecret || '',
          },
          body: JSON.stringify({ type, bookingId, salonId }),
        });
        if (!res.ok) console.error(`Email ${type} failed:`, res.status);
      } catch (err) {
        console.error(`Email ${type} error:`, err);
      }
    };

    // Fire emails non-blocking
    await Promise.allSettled([
      sendEmail('confirmation'),
      sendEmail('notification'),
    ]);

    return { statusCode: 200, headers, body: JSON.stringify({ bookingId }) };
  } catch (err) {
    console.error('Create booking error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};

export { handler };
