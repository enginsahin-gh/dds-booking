import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ServiceCategory } from '../lib/types';

export function useCategories(salonId: string | undefined) {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    const { data } = await supabase
      .from('service_categories')
      .select('*')
      .eq('salon_id', salonId)
      .order('sort_order');
    setCategories(data || []);
    setLoading(false);
  }, [salonId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertCategory = async (cat: Partial<ServiceCategory> & { salon_id: string }) => {
    if (cat.id) {
      const { error } = await supabase.from('service_categories').update(cat).eq('id', cat.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('service_categories').insert(cat);
      if (error) throw error;
    }
    await fetch();
  };

  const deleteCategory = async (id: string) => {
    // Services get category_id set to null via ON DELETE SET NULL
    const { error } = await supabase.from('service_categories').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { categories, loading, refetch: fetch, upsertCategory, deleteCategory };
}
