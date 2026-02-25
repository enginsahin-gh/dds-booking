import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useServices } from '../../hooks/useServices';
import { ServiceTable } from '../../components/admin/ServiceTable';
import { ServiceFormModal } from '../../components/admin/ServiceFormModal';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Service } from '../../lib/types';

export function ServicesPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { services, loading, upsertService, toggleActive } = useServices(salon?.id);
  const { addToast } = useToast();
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = async (data: Partial<Service> & { salon_id: string }) => {
    try {
      await upsertService(data);
      addToast('success', 'Dienst opgeslagen');
    } catch {
      addToast('error', 'Kon dienst niet opslaan');
      throw new Error();
    }
  };

  if (!salon) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Diensten</h1>
        <Button onClick={() => { setEditingService(null); setModalOpen(true); }}>+ Nieuwe dienst</Button>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <ServiceTable
          services={services}
          onEdit={(s) => { setEditingService(s); setModalOpen(true); }}
          onToggleActive={toggleActive}
        />
      )}

      <ServiceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        service={editingService}
        salonId={salon.id}
      />
    </div>
  );
}
