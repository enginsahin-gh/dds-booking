import { useState } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { useStaff, useStaffBlocks } from '../../hooks/useStaff';
import { BlockList } from '../../components/admin/BlockList';
import { AddBlockModal } from '../../components/admin/AddBlockModal';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon } from '../../lib/types';

export function BlocksPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { staff } = useStaff(salon?.id);
  const { blocks, loading, addBlock, removeBlock } = useStaffBlocks(staffId);
  const { addToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const member = staff.find(s => s.id === staffId);

  const handleAdd = async (block: Parameters<typeof addBlock>[0]) => {
    try {
      await addBlock(block);
      addToast('success', 'Blokkade toegevoegd');
    } catch {
      addToast('error', 'Kon blokkade niet toevoegen');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeBlock(id);
      addToast('success', 'Blokkade verwijderd');
    } catch {
      addToast('error', 'Kon blokkade niet verwijderen');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/staff"
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Blokkades</h1>
            {member && <p className="text-[13px] text-gray-500 mt-0.5">{member.name}</p>}
          </div>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Toevoegen
        </Button>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        blocks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            </div>
            <p className="text-[14px] font-medium text-gray-600">Geen blokkades</p>
            <p className="text-[13px] text-gray-400 mt-1">Voeg een blokkade toe voor vakantie, ziekte of andere afwezigheid.</p>
          </div>
        ) : (
          <BlockList blocks={blocks} onRemove={handleRemove} />
        )
      )}

      <AddBlockModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleAdd} staffId={staffId!} />
    </div>
  );
}
