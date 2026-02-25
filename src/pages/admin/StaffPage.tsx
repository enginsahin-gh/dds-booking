import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStaff } from '../../hooks/useStaff';
import { StaffList } from '../../components/admin/StaffList';
import { StaffFormModal } from '../../components/admin/StaffFormModal';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Staff } from '../../lib/types';

export function StaffPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { staff, loading, upsertStaff } = useStaff(salon?.id);
  const { addToast } = useToast();
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = async (data: Partial<Staff> & { salon_id: string }) => {
    try {
      await upsertStaff(data);
      addToast('success', 'Medewerker opgeslagen');
    } catch {
      addToast('error', 'Kon medewerker niet opslaan');
      throw new Error();
    }
  };

  if (!salon) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Medewerkers</h1>
        <Button onClick={() => { setEditingStaff(null); setModalOpen(true); }}>+ Nieuwe medewerker</Button>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <StaffList staff={staff} onEdit={(s) => { setEditingStaff(s); setModalOpen(true); }} />
      )}

      <StaffFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        staff={editingStaff}
        salonId={salon.id}
      />
    </div>
  );
}
