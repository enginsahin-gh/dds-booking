import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Staff, StaffSchedule, StaffBlock } from '../lib/types';

export function useStaff(salonId: string | undefined) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('salon_id', salonId)
      .order('sort_order');
    setStaff(data || []);
    setLoading(false);
  }, [salonId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertStaff = async (member: Partial<Staff> & { salon_id: string }) => {
    if (member.id) {
      const { error } = await supabase.from('staff').update(member).eq('id', member.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('staff').insert(member);
      if (error) throw error;
    }
    await fetch();
  };

  return { staff, loading, refetch: fetch, upsertStaff };
}

export function useStaffSchedules(staffId: string | undefined) {
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!staffId) return;
    const { data } = await supabase
      .from('staff_schedules')
      .select('*')
      .eq('staff_id', staffId)
      .order('day_of_week');
    setSchedules(data || []);
    setLoading(false);
  }, [staffId]);

  useEffect(() => { fetch(); }, [fetch]);

  const saveSchedule = async (schedule: Omit<StaffSchedule, 'id'> & { id?: string }) => {
    const { error } = await supabase
      .from('staff_schedules')
      .upsert(schedule, { onConflict: 'staff_id,day_of_week' });
    if (error) throw error;
    await fetch();
  };

  return { schedules, loading, refetch: fetch, saveSchedule };
}

export function useStaffBlocks(staffId: string | undefined) {
  const [blocks, setBlocks] = useState<StaffBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!staffId) return;
    const { data } = await supabase
      .from('staff_blocks')
      .select('*')
      .eq('staff_id', staffId)
      .order('start_at', { ascending: false });
    setBlocks(data || []);
    setLoading(false);
  }, [staffId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addBlock = async (block: Omit<StaffBlock, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('staff_blocks').insert(block);
    if (error) throw error;
    await fetch();
  };

  const removeBlock = async (id: string) => {
    await supabase.from('staff_blocks').delete().eq('id', id);
    await fetch();
  };

  return { blocks, loading, refetch: fetch, addBlock, removeBlock };
}
