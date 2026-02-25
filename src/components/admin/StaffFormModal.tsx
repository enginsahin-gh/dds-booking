import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Staff } from '../../lib/types';

interface StaffFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Staff> & { salon_id: string }) => Promise<void>;
  staff?: Staff | null;
  salonId: string;
}

export function StaffFormModal({ open, onClose, onSave, staff, salonId }: StaffFormModalProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(staff?.name || '');
  }, [staff, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...(staff?.id ? { id: staff.id } : {}),
        salon_id: salonId,
        name: name.trim(),
      });
      onClose();
    } catch {
      // handled by toast
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={staff ? 'Medewerker bewerken' : 'Nieuwe medewerker'}>
      <div className="space-y-4">
        <Input label="Naam" value={name} onChange={(e) => setName(e.target.value)} placeholder="Volledige naam" />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuleren</Button>
          <Button onClick={handleSave} loading={saving}>Opslaan</Button>
        </div>
      </div>
    </Modal>
  );
}
