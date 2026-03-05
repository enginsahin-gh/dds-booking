import { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { StaffServicesToggle } from './StaffServicesToggle';
import { supabase as sbClient } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
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
  const [allServices, setAllServices] = useState(true);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveServicesRef = useRef<(() => Promise<void>) | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    setName(staff?.name || '');
    setAllServices(staff?.all_services ?? true);
    setPhotoUrl(staff?.photo_url || '');
  }, [staff, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...(staff?.id ? { id: staff.id } : {}),
        salon_id: salonId,
        name: name.trim(),
        all_services: allServices,
        photo_url: photoUrl || null,
      });
      // Save service assignments if not "all services"
      if (!allServices && saveServicesRef.current) {
        await saveServicesRef.current();
      }
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

        <div>
          <label className="text-[13px] font-medium text-gray-700 block mb-2">Profielfoto</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden text-gray-400">
              {photoUrl ? (
                <img src={photoUrl} alt="Staff" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a4 4 0 100 8 4 4 0 000-8zm0 10c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {photoUploading ? 'Uploaden...' : 'Foto uploaden'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={photoUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) { addToast('error', 'Foto mag maximaal 2MB zijn'); return; }
                    setPhotoUploading(true);
                    const ext = file.name.split('.').pop() || 'jpg';
                    const fileId = staff?.id || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
                    const path = `${salonId}/staff/${fileId}.${ext}`;
                    const { error } = await sbClient.storage.from('salon-assets').upload(path, file, { upsert: true });
                    if (error) { addToast('error', 'Upload mislukt: ' + error.message); setPhotoUploading(false); return; }
                    const { data: urlData } = sbClient.storage.from('salon-assets').getPublicUrl(path);
                    setPhotoUrl(urlData.publicUrl + '?t=' + Date.now());
                    addToast('success', 'Foto geupload');
                    setPhotoUploading(false);
                  }}
                />
              </label>
              {photoUrl && (
                <button
                  onClick={() => setPhotoUrl('')}
                  className="text-[12px] text-red-500 hover:text-red-600 font-medium text-left"
                >
                  Verwijderen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Only show services toggle for existing staff (need an ID to save junction records) */}
        {staff?.id && (
          <StaffServicesToggle
            staffId={staff.id}
            salonId={salonId}
            allServices={allServices}
            onAllServicesChange={setAllServices}
            saveRef={saveServicesRef}
          />
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuleren</Button>
          <Button onClick={handleSave} loading={saving}>Opslaan</Button>
        </div>
      </div>
    </Modal>
  );
}
