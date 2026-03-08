import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useStaff } from '../../hooks/useStaff';
import { StaffList } from '../../components/admin/StaffList';
import { StaffFormModal } from '../../components/admin/StaffFormModal';
import { AdminFab } from '../../components/admin/AdminFab';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Staff } from '../../lib/types';

export function StaffPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { isOwner } = useAuth();
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Team</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{staff.length} medewerkers</p>
        </div>
        {isOwner && (
          <Button onClick={() => { setEditingStaff(null); setModalOpen(true); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Toevoegen
          </Button>
        )}
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <StaffList staff={staff} onEdit={isOwner ? (s) => { setEditingStaff(s); setModalOpen(true); } : undefined} />
      )}

      {isOwner && (
        <AdminFab
          label="Nieuwe medewerker"
          onClick={() => { setEditingStaff(null); setModalOpen(true); }}
        />
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
