import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import type { Service, ServiceAddon, ServiceCategory, Staff } from '../../lib/types';

interface ServiceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Service> & { salon_id: string }) => Promise<Service>;
  service?: Service | null;
  salonId: string;
  categories?: ServiceCategory[];
  prefillCategoryId?: string | null;
  staff?: Staff[];
}

type AddonRow = {
  id?: string;
  name: string;
  price: string;
  duration: string;
  is_active: boolean;
};

export function ServiceFormModal({ open, onClose, onSave, service, salonId, categories = [], prefillCategoryId, staff = [] }: ServiceFormModalProps) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('0');
  const [categoryId, setCategoryId] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [staffIds, setStaffIds] = useState<Set<string>>(new Set());
  const [addonRows, setAddonRows] = useState<AddonRow[]>([]);
  const [removedAddonIds, setRemovedAddonIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingExtras, setLoadingExtras] = useState(false);

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDuration(String(service.duration_min));
      setPrice(String(service.price_cents / 100));
      setCategoryId(service.category_id || '');
      setTags(service.tags || []);
    } else {
      setName('');
      setDuration('30');
      setPrice('0');
      setCategoryId(prefillCategoryId || '');
      setTags([]);
    }
    setTagsInput('');
    setStaffIds(new Set());
    setAddonRows([]);
    setRemovedAddonIds([]);
  }, [service, open, prefillCategoryId]);

  useEffect(() => {
    const loadExtras = async () => {
      if (!service?.id) return;
      setLoadingExtras(true);
      const [staffServicesRes, addonsRes] = await Promise.all([
        supabase.from('staff_services').select('staff_id').eq('service_id', service.id),
        supabase.from('service_addons').select('*').eq('service_id', service.id).order('sort_order'),
      ]);
      const existingStaffIds = new Set((staffServicesRes.data || []).map((row: any) => row.staff_id));
      setStaffIds(existingStaffIds);
      setAddonRows((addonsRes.data || []).map((addon: ServiceAddon) => ({
        id: addon.id,
        name: addon.name,
        price: String((addon.price_cents || 0) / 100),
        duration: String(addon.duration_min || 0),
        is_active: addon.is_active,
      })));
      setLoadingExtras(false);
    };
    if (open && service?.id) loadExtras();
  }, [open, service?.id]);

  const parseTags = (value: string) => value.split(',').map(t => t.trim()).filter(Boolean);

  const mergeTagsFromInput = () => {
    const parts = parseTags(tagsInput);
    if (parts.length === 0) return tags;
    const merged = Array.from(new Set([...tags, ...parts]));
    setTags(merged);
    setTagsInput('');
    return merged;
  };

  const toggleStaff = (staffId: string) => {
    setStaffIds(prev => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  };

  const addAddonRow = () => {
    setAddonRows(prev => ([...prev, { name: '', price: '0', duration: '0', is_active: true }]));
  };

  const removeAddonRow = (idx: number) => {
    setAddonRows(prev => {
      const next = [...prev];
      const removed = next.splice(idx, 1)[0];
      if (removed?.id) setRemovedAddonIds(ids => [...ids, removed.id!]);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const mergedTags = mergeTagsFromInput();
      const saved = await onSave({
        ...(service?.id ? { id: service.id } : {}),
        salon_id: salonId,
        name,
        duration_min: parseInt(duration) || 30,
        price_cents: Math.round(parseFloat(price) * 100) || 0,
        category_id: categoryId || null,
        tags: mergedTags,
      });

      const selectableStaff = staff.filter(s => !s.all_services).map(s => s.id);
      if (selectableStaff.length > 0) {
        await supabase.from('staff_services').delete().eq('service_id', saved.id);
        const staffRecords = selectableStaff
          .filter(id => staffIds.has(id))
          .map(id => ({ staff_id: id, service_id: saved.id }));
        if (staffRecords.length > 0) {
          await supabase.from('staff_services').insert(staffRecords);
        }
      }

      if (removedAddonIds.length > 0) {
        await supabase.from('service_addons').delete().in('id', removedAddonIds);
        setRemovedAddonIds([]);
      }

      const normalizedAddons = addonRows
        .map((row, idx) => ({
          id: row.id,
          salon_id: salonId,
          service_id: saved.id,
          name: row.name.trim(),
          price_cents: Math.max(0, Math.round(parseFloat(row.price || '0') * 100)),
          duration_min: Math.max(0, parseInt(row.duration || '0')),
          is_active: row.is_active,
          sort_order: idx,
        }))
        .filter(row => row.name.length > 0);

      const existing = normalizedAddons.filter(row => row.id);
      const fresh = normalizedAddons.filter(row => !row.id);

      if (existing.length > 0) {
        await Promise.all(existing.map(row => (
          supabase.from('service_addons').update({
            name: row.name,
            price_cents: row.price_cents,
            duration_min: row.duration_min,
            is_active: row.is_active,
            sort_order: row.sort_order,
          }).eq('id', row.id)
        )));
      }

      if (fresh.length > 0) {
        await supabase.from('service_addons').insert(fresh.map(row => ({
          salon_id: row.salon_id,
          service_id: row.service_id,
          name: row.name,
          price_cents: row.price_cents,
          duration_min: row.duration_min,
          is_active: row.is_active,
          sort_order: row.sort_order,
        })));
      }

      onClose();
    } catch { /* Toast handles this */ }
    setSaving(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? 'Dienst bewerken' : 'Nieuwe dienst'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} fullWidth>Annuleren</Button>
          <Button onClick={handleSave} loading={saving} fullWidth>Opslaan</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Naam" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Knippen dames" />

        <div className="space-y-2">
          <label className="block text-[13px] font-semibold text-gray-700">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-violet-100 text-violet-700">
                {tag}
                <button type="button" onClick={() => setTags(prev => prev.filter(t => t !== tag))} className="text-violet-500 hover:text-violet-700">
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            onBlur={mergeTagsFromInput}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); mergeTagsFromInput(); } }}
            placeholder="Bijv. Populair, Nieuw"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10"
          />
        </div>

        {categories.length > 0 && (
          <Select
            label="Categorie"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            options={[
              { value: '', label: 'Geen categorie' },
              ...categories.map(c => ({ value: c.id, label: c.name })),
            ]}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Duur (minuten)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="5" step="5" />
          <Input label="Prijs (€)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} min="0" step="0.50" />
        </div>

        {name && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-[13px] text-gray-600 font-medium">{name || 'Dienst'}</span>
            <span className="text-[13px] font-bold text-gray-900">
              {duration} min — €{(parseFloat(price) || 0).toFixed(2).replace('.', ',')}
            </span>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <h4 className="text-[13px] font-semibold text-gray-700 mb-2">Beschikbare medewerkers</h4>
          {staff.length === 0 ? (
            <p className="text-[12px] text-gray-400">Geen medewerkers gevonden.</p>
          ) : (
            <div className="space-y-2">
              {staff.map(member => (
                <label key={member.id} className="flex items-center gap-2.5 text-[13px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={member.all_services || staffIds.has(member.id)}
                    disabled={member.all_services}
                    onChange={() => toggleStaff(member.id)}
                    className="w-4 h-4 rounded border-gray-300 text-violet-600"
                  />
                  <span className="flex-1">{member.name}</span>
                  {member.all_services && (
                    <span className="text-[11px] text-gray-400">Alle diensten</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[13px] font-semibold text-gray-700">Extra's (add‑ons)</h4>
            <button
              type="button"
              onClick={addAddonRow}
              className="text-[12px] font-semibold text-violet-600 hover:text-violet-700"
            >
              + Extra toevoegen
            </button>
          </div>
          {loadingExtras && service?.id ? (
            <p className="text-[12px] text-gray-400">Extra's laden...</p>
          ) : addonRows.length === 0 ? (
            <p className="text-[12px] text-gray-400">Geen extra's toegevoegd.</p>
          ) : (
            <div className="space-y-2">
              {addonRows.map((row, idx) => (
                <div key={row.id || idx} className="grid grid-cols-[1.2fr_0.7fr_0.7fr_auto_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => setAddonRows(prev => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                    placeholder="Naam"
                    className="px-3 py-2 text-[12px] rounded-lg border border-gray-200"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={row.price}
                    onChange={(e) => setAddonRows(prev => prev.map((r, i) => i === idx ? { ...r, price: e.target.value } : r))}
                    className="px-3 py-2 text-[12px] rounded-lg border border-gray-200"
                  />
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={row.duration}
                    onChange={(e) => setAddonRows(prev => prev.map((r, i) => i === idx ? { ...r, duration: e.target.value } : r))}
                    className="px-3 py-2 text-[12px] rounded-lg border border-gray-200"
                  />
                  <label className="flex items-center gap-1.5 text-[12px] text-gray-500">
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      onChange={(e) => setAddonRows(prev => prev.map((r, i) => i === idx ? { ...r, is_active: e.target.checked } : r))}
                    />
                    Actief
                  </label>
                  <button
                    type="button"
                    onClick={() => removeAddonRow(idx)}
                    className="text-[12px] text-red-500 hover:text-red-600"
                  >
                    Verwijder
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_auto_auto] gap-2 text-[11px] text-gray-400">
                <span>Naam</span><span>Prijs (€)</span><span>Duur (min)</span><span></span><span></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
