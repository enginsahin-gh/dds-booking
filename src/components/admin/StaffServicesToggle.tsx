import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Service, ServiceCategory } from '../../lib/types';

interface StaffServicesToggleProps {
  staffId: string;
  salonId: string;
  allServices: boolean;
  onAllServicesChange: (value: boolean) => void;
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

export function StaffServicesToggle({ staffId, salonId, allServices, onAllServicesChange, saveRef }: StaffServicesToggleProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [servicesRes, categoriesRes, staffServicesRes] = await Promise.all([
        supabase.from('services').select('*').eq('salon_id', salonId).eq('is_active', true).order('sort_order'),
        supabase.from('service_categories').select('*').eq('salon_id', salonId).order('sort_order'),
        supabase.from('staff_services').select('service_id').eq('staff_id', staffId),
      ]);
      setServices(servicesRes.data || []);
      setCategories(categoriesRes.data || []);

      const existingIds = new Set((staffServicesRes.data || []).map((ss: any) => ss.service_id));
      // If switching from all_services=true and no records exist, default to all selected
      if (existingIds.size === 0) {
        setSelectedServiceIds(new Set((servicesRes.data || []).map(s => s.id)));
      } else {
        setSelectedServiceIds(existingIds);
      }
      setLoading(false);
    };
    if (staffId) load();
  }, [staffId, salonId]);

  const handleToggleService = (serviceId: string) => {
    setSelectedServiceIds(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const handleToggleAll = async (checked: boolean) => {
    onAllServicesChange(checked);
    if (checked) {
      // Switching to "all services" — delete specific records
      setSaving(true);
      await supabase.from('staff_services').delete().eq('staff_id', staffId);
      setSaving(false);
    }
  };

  const saveServices = async () => {
    if (allServices) return; // No need to save junction records when all_services=true
    // Delete existing and re-insert
    await supabase.from('staff_services').delete().eq('staff_id', staffId);
    if (selectedServiceIds.size > 0) {
      const records = Array.from(selectedServiceIds).map(serviceId => ({
        staff_id: staffId,
        service_id: serviceId,
      }));
      await supabase.from('staff_services').insert(records);
    }
  };

  // Expose save function to parent via ref
  useEffect(() => {
    if (saveRef) saveRef.current = saveServices;
  });

  const handleSave = async () => {
    setSaving(true);
    await saveServices();
    setSaving(false);
  };

  // Group services by category
  const grouped = categories.map(cat => ({
    category: cat,
    services: services.filter(s => s.category_id === cat.id),
  })).filter(g => g.services.length > 0);

  // Uncategorized
  const uncategorized = services.filter(s => !s.category_id);

  if (loading) return <p className="text-sm text-gray-400">Laden...</p>;

  return (
    <div className="pt-4 border-t border-gray-200">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Diensten</h4>

      <label className="flex items-center gap-3 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allServices}
          onChange={(e) => handleToggleAll(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        <div>
          <span className="text-sm font-medium text-gray-700">Alle diensten</span>
          <p className="text-xs text-gray-500">Kan alle behandelingen uitvoeren</p>
        </div>
      </label>

      {!allServices && (
        <div className="ml-1 space-y-4 mt-4">
          {grouped.map(({ category, services: catServices }) => (
            <div key={category.id}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {category.name}
              </p>
              <div className="space-y-1">
                {catServices.map(svc => (
                  <label key={svc.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md px-2 -mx-2">
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.has(svc.id)}
                      onChange={() => handleToggleService(svc.id)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 flex-1">{svc.name}</span>
                    <span className="text-xs text-gray-400">{svc.duration_min} min</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Overig</p>
              <div className="space-y-1">
                {uncategorized.map(svc => (
                  <label key={svc.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md px-2 -mx-2">
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.has(svc.id)}
                      onChange={() => handleToggleService(svc.id)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 flex-1">{svc.name}</span>
                    <span className="text-xs text-gray-400">{svc.duration_min} min</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedServiceIds.size === 0 && (
            <p className="text-xs text-red-500 mt-1">Selecteer minimaal één dienst</p>
          )}
        </div>
      )}
    </div>
  );
}
