import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useServices } from '../../hooks/useServices';
import { useCategories } from '../../hooks/useCategories';
import { ServiceFormModal } from '../../components/admin/ServiceFormModal';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Service, ServiceCategory } from '../../lib/types';

export function ServicesPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { services, loading, upsertService, toggleActive } = useServices(salon?.id);
  const { categories, upsertCategory, deleteCategory, refetch: refetchCats } = useCategories(salon?.id);
  const { addToast } = useToast();
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [prefillCategoryId, setPrefillCategoryId] = useState<string | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  // Group services by category
  const grouped = useMemo(() => {
    const map = new Map<string | null, Service[]>();
    for (const s of services) {
      const key = s.category_id || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [services]);

  const uncategorized = grouped.get(null) || [];

  const toggleCollapse = (id: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSaveService = async (data: Partial<Service> & { salon_id: string }) => {
    try {
      await upsertService(data);
      addToast('success', 'Dienst opgeslagen');
    } catch {
      addToast('error', 'Kon dienst niet opslaan');
      throw new Error();
    }
  };

  const handleSaveCat = async () => {
    if (!salon || !catName.trim()) return;
    setCatSaving(true);
    try {
      await upsertCategory({
        ...(editingCat?.id ? { id: editingCat.id } : {}),
        salon_id: salon.id,
        name: catName.trim(),
        sort_order: editingCat?.sort_order ?? categories.length,
      });
      addToast('success', 'Categorie opgeslagen');
      setCatModalOpen(false);
    } catch {
      addToast('error', 'Kon categorie niet opslaan');
    }
    setCatSaving(false);
  };

  const handleDeleteCat = async (cat: ServiceCategory) => {
    if (!confirm(`"${cat.name}" verwijderen? Diensten worden niet verwijderd, maar komen onder "Overig".`)) return;
    try {
      await deleteCategory(cat.id);
      addToast('success', 'Categorie verwijderd');
    } catch {
      addToast('error', 'Kon categorie niet verwijderen');
    }
  };

  if (!salon) return null;

  const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2).replace('.', ',')}`;

  const ServiceCard = ({ service }: { service: Service }) => (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
        service.is_active ? 'bg-white border-gray-100 hover:border-violet-200' : 'bg-gray-50 border-gray-100 opacity-60'
      }`}
      onClick={() => { setEditingService(service); setPrefillCategoryId(service.category_id); setServiceModalOpen(true); }}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{service.name}</p>
        <p className="text-xs text-gray-500">{service.duration_min} min</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700">{formatPrice(service.price_cents)}</span>
        <button
          onClick={e => { e.stopPropagation(); toggleActive(service.id, !service.is_active); }}
          className={`w-9 h-5 rounded-full transition-colors relative ${service.is_active ? 'bg-violet-600' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${service.is_active ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Diensten</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingCat(null); setCatName(''); setCatModalOpen(true); }}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            + Categorie
          </button>
          <button
            onClick={() => { setEditingService(null); setPrefillCategoryId(null); setServiceModalOpen(true); }}
            className="px-3 py-2 text-sm font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors"
          >
            + Dienst
          </button>
        </div>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <div className="space-y-4">
          {categories.map(cat => {
            const catServices = grouped.get(cat.id) || [];
            const isCollapsed = collapsedCats.has(cat.id);

            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Category header */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleCollapse(cat.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900">{cat.name}</h3>
                    <span className="text-xs text-gray-400">{catServices.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); setEditingCat(cat); setCatName(cat.name); setCatModalOpen(true); }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                      title="Bewerken"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteCat(cat); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                      title="Verwijderen"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingService(null); setPrefillCategoryId(cat.id); setServiceModalOpen(true); }}
                      className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50"
                      title="Dienst toevoegen"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Services list */}
                {!isCollapsed && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {catServices.length > 0 ? (
                      catServices.map(s => <ServiceCard key={s.id} service={s} />)
                    ) : (
                      <p className="text-xs text-gray-400 py-3 text-center">Geen diensten in deze categorie</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized */}
          {uncategorized.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">Overig</h3>
              <div className="space-y-1.5">
                {uncategorized.map(s => <ServiceCard key={s.id} service={s} />)}
              </div>
            </div>
          )}

          {services.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">Nog geen diensten</p>
              <button
                onClick={() => { setEditingService(null); setPrefillCategoryId(null); setServiceModalOpen(true); }}
                className="mt-2 text-violet-600 text-sm font-medium hover:underline"
              >
                Eerste dienst toevoegen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Service form modal */}
      <ServiceFormModal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        onSave={handleSaveService}
        service={editingService}
        salonId={salon.id}
        categories={categories}
        prefillCategoryId={prefillCategoryId}
      />

      {/* Category modal */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCat ? 'Categorie bewerken' : 'Nieuwe categorie'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Naam</label>
            <input
              type="text"
              value={catName}
              onChange={e => setCatName(e.target.value)}
              placeholder="Bijv. Knippen, Kleuren, Nagels"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSaveCat(); }}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCatModalOpen(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Annuleren</button>
            <button onClick={handleSaveCat} disabled={catSaving || !catName.trim()} className="flex-1 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              {catSaving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
