import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useServices } from '../../hooks/useServices';
import { useCategories } from '../../hooks/useCategories';
import { ServiceFormModal } from '../../components/admin/ServiceFormModal';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Service, ServiceCategory } from '../../lib/types';

export function ServicesPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { services, loading, upsertService, toggleActive } = useServices(salon?.id);
  const { categories, upsertCategory, deleteCategory } = useCategories(salon?.id);
  const { addToast } = useToast();
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [prefillCategoryId, setPrefillCategoryId] = useState<string | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

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
      className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
        service.is_active
          ? 'bg-white border-gray-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-200'
          : 'bg-gray-50/80 border-gray-100 opacity-50'
      }`}
      onClick={() => { setEditingService(service); setPrefillCategoryId(service.category_id); setServiceModalOpen(true); }}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-gray-900 truncate">{service.name}</p>
        <p className="text-[12px] text-gray-500 mt-0.5">{service.duration_min} min</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[14px] font-bold text-gray-900">{formatPrice(service.price_cents)}</span>
        <div
          role="switch"
          aria-checked={service.is_active}
          tabIndex={0}
          onClick={e => { e.stopPropagation(); toggleActive(service.id, !service.is_active); }}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggleActive(service.id, !service.is_active); } }}
          className={`w-9 h-5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] relative cursor-pointer flex-shrink-0 ${
            service.is_active ? 'bg-violet-600 hover:bg-violet-700' : 'bg-gray-300 hover:bg-gray-400'
          }`}
        >
          <span
            className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              service.is_active ? 'translate-x-[16px]' : 'translate-x-[2px]'
            }`}
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.14)' }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Diensten</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{services.length} diensten in {categories.length} categorieën</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setEditingCat(null); setCatName(''); setCatModalOpen(true); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="hidden sm:inline">Categorie</span>
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditingService(null); setPrefillCategoryId(null); setServiceModalOpen(true); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Dienst</span>
          </Button>
        </div>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <div className="space-y-4">
          {categories.map(cat => {
            const catServices = grouped.get(cat.id) || [];
            const isCollapsed = collapsedCats.has(cat.id);

            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                {/* Category header */}
                <div
                  className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => toggleCollapse(cat.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-[14px] font-bold text-gray-900">{cat.name}</h3>
                    <span className="text-[12px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-md">{catServices.length}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); setEditingCat(cat); setCatName(cat.name); setCatModalOpen(true); }}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Bewerken"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteCat(cat); }}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      title="Verwijderen"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingService(null); setPrefillCategoryId(cat.id); setServiceModalOpen(true); }}
                      className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"
                      title="Dienst toevoegen"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Services list */}
                {!isCollapsed && (
                  <div className="px-4 pb-4 space-y-2">
                    {catServices.length > 0 ? (
                      catServices.map(s => <ServiceCard key={s.id} service={s} />)
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-[13px] text-gray-400">Geen diensten in deze categorie</p>
                        <button
                          onClick={() => { setEditingService(null); setPrefillCategoryId(cat.id); setServiceModalOpen(true); }}
                          className="text-[13px] text-violet-600 font-medium hover:underline mt-1"
                        >
                          Voeg een dienst toe
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized */}
          {uncategorized.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 px-1">Overig</h3>
              <div className="space-y-2">
                {uncategorized.map(s => <ServiceCard key={s.id} service={s} />)}
              </div>
            </div>
          )}

          {services.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-gray-600">Nog geen diensten</p>
              <p className="text-[13px] text-gray-400 mt-1">Voeg je eerste dienst toe om boekingen te ontvangen.</p>
              <button
                onClick={() => { setEditingService(null); setPrefillCategoryId(null); setServiceModalOpen(true); }}
                className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-semibold text-violet-600 hover:text-violet-700 transition-colors"
              >
                Eerste dienst toevoegen
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </div>
      )}

      <ServiceFormModal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        onSave={handleSaveService}
        service={editingService}
        salonId={salon.id}
        categories={categories}
        prefillCategoryId={prefillCategoryId}
      />

      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCat ? 'Categorie bewerken' : 'Nieuwe categorie'} size="sm">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-gray-700">Naam</label>
            <input
              type="text"
              value={catName}
              onChange={e => setCatName(e.target.value)}
              placeholder="Bijv. Knippen, Kleuren, Nagels"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-[14px] focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all duration-200 placeholder:text-gray-400"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSaveCat(); }}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setCatModalOpen(false)} fullWidth>Annuleren</Button>
            <Button onClick={handleSaveCat} loading={catSaving} disabled={!catName.trim()} fullWidth>Opslaan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
