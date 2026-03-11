import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Service } from '../lib/types';

export function useServices(salonId: string | undefined) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('salon_id', salonId)
      .order('sort_order');
    if (error) console.error('useServices error:', error.message);
    setServices(data || []);
    setLoading(false);
  }, [salonId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertService = async (service: Partial<Service> & { salon_id: string }): Promise<Service> => {
    if (service.id) {
      const { data, error } = await supabase.from('services').update(service).eq('id', service.id).select().single();
      if (error) throw error;
      await fetch();
      return data as Service;
    }
    const { data, error } = await supabase.from('services').insert(service).select().single();
    if (error) throw error;
    await fetch();
    return data as Service;
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from('services').update({ is_active: isActive }).eq('id', id);
    await fetch();
  };

  const deleteService = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    await fetch();
  };

  const updateServiceOrder = async (orderedIds: string[]) => {
    await Promise.all(
      orderedIds.map((id, idx) => (
        supabase.from('services').update({ sort_order: idx }).eq('id', id)
      ))
    );
    await fetch();
  };

  return { services, loading, refetch: fetch, upsertService, toggleActive, deleteService, updateServiceOrder };
}
