import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Service } from '../../lib/types';

interface ServiceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Service> & { salon_id: string }) => Promise<void>;
  service?: Service | null;
  salonId: string;
}

export function ServiceFormModal({ open, onClose, onSave, service, salonId }: ServiceFormModalProps) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDuration(String(service.duration_min));
      setPrice(String(service.price_cents / 100));
    } else {
      setName('');
      setDuration('30');
      setPrice('0');
    }
  }, [service, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...(service?.id ? { id: service.id } : {}),
        salon_id: salonId,
        name,
        duration_min: parseInt(duration) || 30,
        price_cents: Math.round(parseFloat(price) * 100) || 0,
      });
      onClose();
    } catch {
      // Toast handles this
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={service ? 'Dienst bewerken' : 'Nieuwe dienst'}>
      <div className="space-y-4">
        <Input label="Naam" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Knippen dames" />
        <Input label="Duur (minuten)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="5" step="5" />
        <Input label="Prijs (€)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} min="0" step="0.50" />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuleren</Button>
          <Button onClick={handleSave} loading={saving}>Opslaan</Button>
        </div>
      </div>
    </Modal>
  );
}
