import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Service } from '../lib/types';

export function useServices(salonId: string | undefined) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('salon_id', salonId)
      .order('sort_order');
    setServices(data || []);
    setLoading(false);
  }, [salonId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertService = async (service: Partial<Service> & { salon_id: string }) => {
    if (service.id) {
      const { error } = await supabase.from('services').update(service).eq('id', service.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('services').insert(service);
      if (error) throw error;
    }
    await fetch();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from('services').update({ is_active: isActive }).eq('id', id);
    await fetch();
  };

  return { services, loading, refetch: fetch, upsertService, toggleActive };
}
