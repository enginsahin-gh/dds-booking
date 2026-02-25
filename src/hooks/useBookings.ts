import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Booking } from '../lib/types';

export function useBookings(salonId: string | undefined, dateRange?: { start: string; end: string }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('salon_id', salonId)
      .order('start_at');

    if (dateRange) {
      query = query.gte('start_at', dateRange.start).lt('start_at', dateRange.end);
    }

    const { data } = await query;
    setBookings(data || []);
    setLoading(false);
  }, [salonId, dateRange?.start, dateRange?.end]);

  useEffect(() => { fetch(); }, [fetch]);

  const cancelBooking = async (id: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    // Send cancellation email
    try {
      await globalThis.fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cancellation', bookingId: id, salonId }),
      });
    } catch {
      // Email failure doesn't block cancellation
    }

    await fetch();
  };

  return { bookings, loading, refetch: fetch, cancelBooking };
}
