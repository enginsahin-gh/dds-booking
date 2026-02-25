import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface AddBlockModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (block: { staff_id: string; start_at: string; end_at: string; reason: string | null }) => Promise<void>;
  staffId: string;
}

export function AddBlockModal({ open, onClose, onSave, staffId }: AddBlockModalProps) {
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!startAt || !endAt) return;
    setSaving(true);
    try {
      await onSave({
        staff_id: staffId,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        reason: reason.trim() || null,
      });
      setStartAt('');
      setEndAt('');
      setReason('');
      onClose();
    } catch { /* toast */ }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Blokkade toevoegen">
      <div className="space-y-4">
        <Input label="Van" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        <Input label="Tot" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        <Input label="Reden (optioneel)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bijv. vakantie, ziek" />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuleren</Button>
          <Button onClick={handleSave} loading={saving}>Opslaan</Button>
        </div>
      </div>
    </Modal>
  );
}
