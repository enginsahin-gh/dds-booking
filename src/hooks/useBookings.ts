import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { API_BASE } from '../lib/config';
import { useAuth } from './useAuth';
import type { Booking } from '../lib/types';

export function useBookings(salonId: string | undefined, dateRange?: { start: string; end: string }) {
  const { getReadableStaffIds } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    setError(null);
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('salon_id', salonId)
      .order('start_at');

    if (dateRange) {
      query = query.gte('start_at', dateRange.start).lt('start_at', dateRange.end);
    }

    // Apply staff scope filter
    const readableIds = getReadableStaffIds();
    if (readableIds !== null) {
      query = query.in('staff_id', readableIds);
    }

    const { data, error: queryError } = await query;
    if (queryError) {
      console.error('useBookings error:', queryError.message);
      setError('Kon boekingen niet laden');
    }
    setBookings(data || []);
    setLoading(false);
  }, [salonId, dateRange?.start, dateRange?.end, getReadableStaffIds]);

  useEffect(() => { fetch(); }, [fetch]);

  const cancelBooking = async (id: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    // Send cancellation + notification emails via Worker API
    const apiBase = API_BASE;
    try {
      await Promise.allSettled([
        globalThis.fetch(`${apiBase}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cancellation', bookingId: id, salonId }),
        }),
        globalThis.fetch(`${apiBase}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cancellation_notification', bookingId: id, salonId }),
        }),
      ]);
    } catch {
      // Email failure doesn't block cancellation
    }

    await fetch();
  };

  const updateBookingStatus = async (id: string, status: 'completed' | 'no_show') => {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const completeBooking = async (id: string) => updateBookingStatus(id, 'completed');
  const noShowBooking = async (id: string) => updateBookingStatus(id, 'no_show');

  return { bookings, loading, error, refetch: fetch, cancelBooking, completeBooking, noShowBooking };
}
