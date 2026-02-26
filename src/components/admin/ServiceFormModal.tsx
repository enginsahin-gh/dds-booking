import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Service, ServiceCategory } from '../../lib/types';

interface ServiceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Service> & { salon_id: string }) => Promise<void>;
  service?: Service | null;
  salonId: string;
  categories?: ServiceCategory[];
  prefillCategoryId?: string | null;
}

export function ServiceFormModal({ open, onClose, onSave, service, salonId, categories = [], prefillCategoryId }: ServiceFormModalProps) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('0');
  const [categoryId, setCategoryId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDuration(String(service.duration_min));
      setPrice(String(service.price_cents / 100));
      setCategoryId(service.category_id || '');
    } else {
      setName('');
      setDuration('30');
      setPrice('0');
      setCategoryId(prefillCategoryId || '');
    }
  }, [service, open, prefillCategoryId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...(service?.id ? { id: service.id } : {}),
        salon_id: salonId,
        name,
        duration_min: parseInt(duration) || 30,
        price_cents: Math.round(parseFloat(price) * 100) || 0,
        category_id: categoryId || null,
      });
      onClose();
    } catch { /* Toast handles this */ }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={service ? 'Dienst bewerken' : 'Nieuwe dienst'}>
      <div className="space-y-4">
        <Input label="Naam" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Knippen dames" />

        {categories.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="">Geen categorie</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Duur (minuten)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="5" step="5" />
          <Input label="Prijs (€)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} min="0" step="0.50" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuleren</Button>
          <Button onClick={handleSave} loading={saving}>Opslaan</Button>
        </div>
      </div>
    </Modal>
  );
}
