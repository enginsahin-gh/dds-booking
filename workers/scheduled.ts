import type { Env } from './api';
import { getSupabase } from './lib/supabase';

/**
 * Scheduled handler: runs every 15 minutes via CF Workers cron trigger.
 * Sends appointment reminders:
 * - 24h before: "Herinnering: morgen heb je een afspraak"
 * - 1h before: "Over een uur: je afspraak bij [salon]"
 */
export async function handleScheduled(env: Env): Promise<void> {
  const supabase = getSupabase(env);
  const now = new Date();

  // Window for 24h reminder: bookings starting 23h-25h from now (gives 2h window for cron tolerance)
  const h24Start = new Date(now.getTime() + 23 * 3600000).toISOString();
  const h24End = new Date(now.getTime() + 25 * 3600000).toISOString();

  // Window for 1h reminder: bookings starting 45min-75min from now
  const h1Start = new Date(now.getTime() + 45 * 60000).toISOString();
  const h1End = new Date(now.getTime() + 75 * 60000).toISOString();

  // Fetch bookings needing 24h reminder
  const { data: reminders24h } = await supabase
    .from('bookings')
    .select('id, salon_id, customer_name, customer_email, start_at, service_id, staff_id')
    .eq('status', 'confirmed')
    .is('reminder_24h_sent_at', null)
    .gte('start_at', h24Start)
    .lt('start_at', h24End)
    .limit(50);

  // Fetch bookings needing 1h reminder
  const { data: reminders1h } = await supabase
    .from('bookings')
    .select('id, salon_id, customer_name, customer_email, start_at, service_id, staff_id')
    .eq('status', 'confirmed')
    .is('reminder_1h_sent_at', null)
    .gte('start_at', h1Start)
    .lt('start_at', h1End)
    .limit(50);

  const siteUrl = env.SITE_URL || 'https://api.bellure.nl';
  const emailSecret = env.EMAIL_SECRET;

  const sendReminder = async (bookingId: string, salonId: string, type: 'reminder_24h' | 'reminder_1h') => {
    try {
      const res = await fetch(`${siteUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-email-secret': emailSecret || '' },
        body: JSON.stringify({ type, bookingId, salonId }),
      });

      if (res.ok) {
        // Mark reminder as sent
        const col = type === 'reminder_24h' ? 'reminder_24h_sent_at' : 'reminder_1h_sent_at';
        await supabase.from('bookings').update({ [col]: new Date().toISOString() }).eq('id', bookingId);
      } else {
        console.error(`Reminder ${type} failed for ${bookingId}:`, res.status);
      }
    } catch (err) {
      console.error(`Reminder ${type} error for ${bookingId}:`, err);
    }
  };

  // Send all reminders
  const tasks: Promise<void>[] = [];

  for (const b of (reminders24h || [])) {
    tasks.push(sendReminder(b.id, b.salon_id, 'reminder_24h'));
  }

  for (const b of (reminders1h || [])) {
    tasks.push(sendReminder(b.id, b.salon_id, 'reminder_1h'));
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
    console.log(`Sent ${tasks.length} reminders (24h: ${reminders24h?.length || 0}, 1h: ${reminders1h?.length || 0})`);
  }

  // --- Review requests: send 2 hours after appointment ended ---
  const reviewWindowStart = new Date(now.getTime() - 4 * 3600000).toISOString(); // ended 2-4h ago
  const reviewWindowEnd = new Date(now.getTime() - 2 * 3600000).toISOString();   // at least 2h ago

  const { data: reviewBookings } = await supabase
    .from('bookings')
    .select('id, salon_id, customer_name, customer_email, end_at')
    .eq('status', 'confirmed')
    .is('review_request_sent_at', null)
    .gte('end_at', reviewWindowStart)
    .lt('end_at', reviewWindowEnd)
    .limit(50);

  if (reviewBookings && reviewBookings.length > 0) {
    // Get salon Google Place IDs
    const salonIds = [...new Set(reviewBookings.map(b => b.salon_id))];
    const { data: salons } = await supabase
      .from('salons')
      .select('id, google_place_id, name, review_enabled, review_after_visit')
      .in('id', salonIds);

    const salonMap = new Map((salons || []).map(s => [s.id, s]));

    const reviewTasks: Promise<void>[] = [];
    for (const b of reviewBookings) {
      const salonInfo = salonMap.get(b.salon_id);

      // Skip if reviews disabled or no Place ID
      if (!salonInfo?.review_enabled || !salonInfo?.google_place_id) continue;

      const requiredVisits = salonInfo.review_after_visit || 3;

      // Once per customer per salon — ever
      const { data: alreadySent } = await supabase
        .from('bookings')
        .select('id')
        .eq('salon_id', b.salon_id)
        .eq('customer_email', b.customer_email)
        .not('review_request_sent_at', 'is', null)
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue;

      // Count completed visits for this customer at this salon
      const { count: visitCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', b.salon_id)
        .eq('customer_email', b.customer_email)
        .eq('status', 'confirmed')
        .lt('end_at', now.toISOString());

      // Not enough visits yet — skip, will re-check on next visit
      if ((visitCount || 0) < requiredVisits) continue;

      reviewTasks.push((async () => {
        try {
          const res = await fetch(`${siteUrl}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-email-secret': emailSecret || '' },
            body: JSON.stringify({ type: 'review_request', bookingId: b.id, salonId: b.salon_id }),
          });
          if (res.ok) {
            await supabase.from('bookings').update({ review_request_sent_at: new Date().toISOString() }).eq('id', b.id);
          }
        } catch (err) {
          console.error(`Review request error for ${b.id}:`, err);
        }
      })());
    }

    if (reviewTasks.length > 0) {
      await Promise.allSettled(reviewTasks);
      console.log(`Sent ${reviewTasks.length} review requests`);
    }
  }
}
