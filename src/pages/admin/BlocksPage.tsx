import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStaffBlocks } from '../../hooks/useStaff';
import { BlockList } from '../../components/admin/BlockList';
import { AddBlockModal } from '../../components/admin/AddBlockModal';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';

export function BlocksPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { blocks, loading, addBlock, removeBlock } = useStaffBlocks(staffId);
  const { addToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/admin/staff" className="text-gray-400 hover:text-gray-600">← Terug</Link>
          <h1 className="text-2xl font-bold text-gray-900">Blokkades</h1>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Blokkade toevoegen</Button>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <BlockList blocks={blocks} onRemove={handleRemove} />
      )}

      <AddBlockModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleAdd} staffId={staffId!} />
    </div>
  );
}
