import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Salon } from '../lib/types';

export function useSalon(slug?: string, ownerId?: string) {
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug && !ownerId) return;

    const fetch = async () => {
      setLoading(true);
      setError(null);

      let query = supabase.from('salons').select('*');
      if (slug) query = query.eq('slug', slug);
      if (ownerId) query = query.eq('owner_id', ownerId);

      const { data, error: err } = await query.single();
      if (err) setError('Salon niet gevonden');
      else setSalon(data);
      setLoading(false);
    };

    fetch();
  }, [slug, ownerId]);

  const updateSalon = async (updates: Partial<Salon>) => {
    if (!salon) return;
    const { data, error: err } = await supabase
      .from('salons')
      .update(updates)
      .eq('id', salon.id)
      .select()
      .single();
    if (err) throw err;
    setSalon(data);
  };

  return { salon, loading, error, updateSalon };
}
