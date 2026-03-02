import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select } from '../ui/Input';
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

        {/* Price/duration preview */}
        {name && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-[13px] text-gray-600 font-medium">{name || 'Dienst'}</span>
            <span className="text-[13px] font-bold text-gray-900">
              {duration} min — €{(parseFloat(price) || 0).toFixed(2).replace('.', ',')}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
