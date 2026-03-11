import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useServices } from '../../hooks/useServices';
import { useCategories } from '../../hooks/useCategories';
import { useStaff } from '../../hooks/useStaff';
import { ServiceFormModal } from '../../components/admin/ServiceFormModal';
import { AdminFab } from '../../components/admin/AdminFab';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Service, ServiceCategory } from '../../lib/types';

export function ServicesPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { services, loading, upsertService, toggleActive, deleteService, updateServiceOrder } = useServices(salon?.id);
  const { categories, upsertCategory, deleteCategory, updateCategoryOrder } = useCategories(salon?.id);
  const { staff } = useStaff(salon?.id);
  const { addToast } = useToast();
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [prefillCategoryId, setPrefillCategoryId] = useState<string | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null);
  const [dragServiceId, setDragServiceId] = useState<string | null>(null);
  const [dragServiceCategoryId, setDragServiceCategoryId] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter(s => {
      if (statusFilter === 'active' && !s.is_active) return false;
      if (statusFilter === 'inactive' && s.is_active) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [services, search, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string | null, Service[]>();
    for (const s of filteredServices) {
      const key = s.category_id || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [filteredServices]);

  const uncategorized = grouped.get(null) || [];

  const isFiltering = search.trim().length > 0 || statusFilter !== 'all';
  const canReorder = !isFiltering;
  const visibleCategories = isFiltering
    ? categories.filter(c => (grouped.get(c.id) || []).length > 0)
    : categories;

  const toggleCollapse = (id: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSaveService = async (data: Partial<Service> & { salon_id: string }) => {
    try {
      const saved = await upsertService(data);
      addToast('success', 'Dienst opgeslagen');
      return saved;
    } catch {
      addToast('error', 'Kon dienst niet opslaan');
      throw new Error();
    }
  };

  const handleQuickUpdate = async (serviceId: string, patch: Partial<Service>) => {
    if (!salon) return;
    try {
      await upsertService({ id: serviceId, salon_id: salon.id, ...patch });
      addToast('success', 'Dienst bijgewerkt');
    } catch {
      addToast('error', 'Kon dienst niet bijwerken');
    }
  };

  const handleDuplicate = async (service: Service) => {
    if (!salon) return;
    const maxSort = Math.max(0, ...services.map(s => s.sort_order ?? 0));
    try {
      await upsertService({
        salon_id: salon.id,
        name: `${service.name} (kopie)`,
        duration_min: service.duration_min,
        price_cents: service.price_cents,
        category_id: service.category_id,
        is_active: service.is_active,
        sort_order: maxSort + 1,
      });
      addToast('success', 'Dienst gedupliceerd');
    } catch {
      addToast('error', 'Kon dienst niet dupliceren');
    }
  };

  const handleDeleteService = async (service: Service) => {
    if (!confirm(`Dienst "${service.name}" verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
    try {
      await deleteService(service.id);
      addToast('success', 'Dienst verwijderd');
    } catch {
      addToast('error', 'Kon dienst niet verwijderen');
    }
  };

  const handleCategoryDrop = async (targetId: string) => {
    if (!canReorder || !dragCategoryId || dragCategoryId === targetId) return;
    const ids = categories.map(c => c.id);
    const from = ids.indexOf(dragCategoryId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await updateCategoryOrder(next);
    setDragCategoryId(null);
  };

  const handleServiceDrop = async (targetService: Service) => {
    if (!canReorder || !dragServiceId) return;
    const targetCat = targetService.category_id || null;
    if (dragServiceCategoryId !== targetCat) return;
    if (dragServiceId === targetService.id) return;

    const list = services.filter(s => (s.category_id || null) === targetCat);
    const ids = list.map(s => s.id);
    const from = ids.indexOf(dragServiceId);
    const to = ids.indexOf(targetService.id);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await updateServiceOrder(next);
    setDragServiceId(null);
    setDragServiceCategoryId(null);
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
  const totalCount = services.length;
  const filteredCount = filteredServices.length;
  const activeCount = services.filter(s => s.is_active).length;

  const ServiceCard = ({ service }: { service: Service }) => {
    const [quickEdit, setQuickEdit] = useState(false);
    const [duration, setDuration] = useState(String(service.duration_min));
    const [price, setPrice] = useState(String(service.price_cents / 100));

    useEffect(() => {
      if (!quickEdit) {
        setDuration(String(service.duration_min));
        setPrice(String(service.price_cents / 100));
      }
    }, [service, quickEdit]);

    const saveQuick = async () => {
      const durationMin = Math.max(5, parseInt(duration) || service.duration_min);
      const priceCents = Math.max(0, Math.round(parseFloat(price || '0') * 100));
      await handleQuickUpdate(service.id, { duration_min: durationMin, price_cents: priceCents });
      setQuickEdit(false);
    };

    return (
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
          service.is_active
            ? 'bg-white border-gray-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-200'
            : 'bg-gray-50/80 border-gray-100 opacity-50'
        }`}
        onClick={() => { if (!quickEdit) { setEditingService(service); setPrefillCategoryId(service.category_id); setServiceModalOpen(true); } }}
        onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
        onDrop={canReorder ? () => handleServiceDrop(service) : undefined}
      >
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-gray-900 truncate">{service.name}</p>
          <p className="text-[12px] text-gray-500 mt-0.5">{service.duration_min} min</p>
          {service.tags && service.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {service.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {canReorder && (
            <button
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                setDragServiceId(service.id);
                setDragServiceCategoryId(service.category_id || null);
              }}
              onDragEnd={(e) => {
                e.stopPropagation();
                setDragServiceId(null);
                setDragServiceCategoryId(null);
              }}
              onClick={e => e.stopPropagation()}
              className="p-1.5 text-gray-300 hover:text-gray-500 cursor-grab"
              title="Versleep om te ordenen"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4M10 12h4M10 20h4" />
              </svg>
            </button>
          )}
          {!quickEdit ? (
            <span className="text-[14px] font-bold text-gray-900">{formatPrice(service.price_cents)}</span>
          ) : (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-16 px-2 py-1 text-[12px] rounded-lg border border-gray-200"
              />
              <input
                type="number"
                min={0}
                step={0.5}
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-20 px-2 py-1 text-[12px] rounded-lg border border-gray-200"
              />
            </div>
          )}

          {quickEdit ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={saveQuick}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-gray-900 text-white hover:bg-black"
              >
                Opslaan
              </button>
              <button
                onClick={() => setQuickEdit(false)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-gray-100 text-gray-700"
              >
                Annuleren
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setQuickEdit(true); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Snel bewerken"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDuplicate(service); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Dupliceren"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteService(service); }}
                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                title="Verwijderen"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}

          <div
            role="switch"
            aria-label="Actief"
            aria-checked={service.is_active}
            tabIndex={0}
            onClick={e => { e.stopPropagation(); toggleActive(service.id, !service.is_active); }}
            onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggleActive(service.id, !service.is_active); } }}
            className={`inline-flex items-center w-11 h-6 rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] relative cursor-pointer flex-shrink-0 ${
              service.is_active ? 'bg-violet-600 hover:bg-violet-700' : 'bg-gray-300 hover:bg-gray-400'
            }`}
          >
            <span
              className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                service.is_active ? 'translate-x-[22px]' : 'translate-x-[2px]'
              }`}
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.14)' }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Diensten</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {isFiltering
              ? `${filteredCount} van ${totalCount} diensten`
              : `${totalCount} diensten in ${categories.length} categorieën`} · {activeCount} actief
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek dienst"
              className="w-full sm:w-64 px-4 py-2.5 text-[13px] rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Leegmaken"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2.5 text-[13px] rounded-xl border border-gray-200 bg-white"
          >
            <option value="all">Alle diensten</option>
            <option value="active">Alleen actief</option>
            <option value="inactive">Alleen inactief</option>
          </select>
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
        {!canReorder && (
          <div className="text-[11px] text-amber-600 mt-2">
            Sortering is uitgeschakeld tijdens zoeken/filteren.
          </div>
        )}
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <div className="space-y-4">
          {isFiltering && filteredServices.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[14px] font-medium text-gray-600">Geen diensten gevonden</p>
              <p className="text-[13px] text-gray-400 mt-1">Pas je zoekterm of filter aan.</p>
            </div>
          )}

          {visibleCategories.map(cat => {
            const catServices = grouped.get(cat.id) || [];
            const isCollapsed = collapsedCats.has(cat.id);

            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                {/* Category header */}
                <div
                  className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => toggleCollapse(cat.id)}
                  onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
                  onDrop={canReorder ? () => handleCategoryDrop(cat.id) : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    {canReorder && (
                      <button
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); setDragCategoryId(cat.id); }}
                        onDragEnd={(e) => { e.stopPropagation(); setDragCategoryId(null); }}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-gray-300 hover:text-gray-500 cursor-grab"
                        title="Versleep om te ordenen"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4M10 12h4M10 20h4" />
                        </svg>
                      </button>
                    )}
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

      <AdminFab
        label="Nieuwe dienst"
        onClick={() => { setEditingService(null); setPrefillCategoryId(null); setServiceModalOpen(true); }}
      />

      <ServiceFormModal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        onSave={handleSaveService}
        service={editingService}
        salonId={salon.id}
        categories={categories}
        staff={staff}
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
