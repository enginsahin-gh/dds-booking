import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { supabase } from '../lib/supabase';
import { getAvailableSlots } from '../lib/slots';
import type { Staff, StaffSchedule, StaffBlock, PublicBooking, TimeSlot } from '../lib/types';

export function useSlots(
  date: Date | null,
  durationMin: number,
  staffList: Staff[],
  selectedStaffId: string | null,
  timezone: string
) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  // Stabilize staffList reference by comparing IDs (BUG-002)
  const staffIds = useMemo(
    () => staffList.map((s) => s.id).sort().join(','),
    [staffList]
  );
  const staffListRef = useRef(staffList);
  if (staffList.map((s) => s.id).sort().join(',') === staffIds) {
    staffListRef.current = staffList;
  }

  const fetchSlots = useCallback(async () => {
    if (!date || !staffIds || !durationMin) return;

    setLoading(true);

    const currentStaff = staffListRef.current;
    const ids = selectedStaffId ? [selectedStaffId] : currentStaff.map((s) => s.id);
    const dayStart = fromZonedTime(startOfDay(date), timezone).toISOString();
    const dayEnd = fromZonedTime(endOfDay(date), timezone).toISOString();

    // Fetch schedules, blocks, and existing bookings in parallel
    const [schedulesRes, blocksRes, bookingsRes] = await Promise.all([
      supabase.from('staff_schedules').select('*').in('staff_id', ids),
      supabase.from('staff_blocks').select('*').in('staff_id', ids)
        .lte('start_at', dayEnd).gte('end_at', dayStart),
      supabase.from('public_bookings').select('*').in('staff_id', ids)
        .gte('start_at', dayStart).lt('start_at', dayEnd),
    ]);

    const schedules: StaffSchedule[] = schedulesRes.data || [];
    const blocks: StaffBlock[] = blocksRes.data || [];
    const bookings: PublicBooking[] = bookingsRes.data || [];

    const available = getAvailableSlots(
      date, durationMin, currentStaff, schedules, blocks, bookings, timezone, selectedStaffId
    );

    setSlots(available);
    setLoading(false);
  }, [date, durationMin, staffIds, selectedStaffId, timezone]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  return { slots, loading, refetch: fetchSlots };
}
