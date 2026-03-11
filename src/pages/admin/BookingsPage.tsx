import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, format, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';
import { useBookings } from '../../hooks/useBookings';
import { useServices } from '../../hooks/useServices';
import { useStaff } from '../../hooks/useStaff';
import { DateNavigator } from '../../components/admin/DateNavigator';
import { BookingList } from '../../components/admin/BookingList';
import { BookingDetailModal } from '../../components/admin/BookingDetailModal';
const AgendaView = lazy(() => import('../../components/admin/AgendaView').then(m => ({ default: m.AgendaView })));
const WeekAgendaView = lazy(() => import('../../components/admin/WeekAgendaView').then(m => ({ default: m.WeekAgendaView })));
import { CreateBookingModal } from '../../components/admin/CreateBookingModal';
import { AdminFab } from '../../components/admin/AdminFab';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Booking } from '../../lib/types';

type ViewMode = 'day' | 'week' | 'agenda';

export function BookingsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('agenda');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ staffId?: string; time?: string }>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'cancel' | 'complete' | 'no_show' | null>(null);

  const handleNow = () => {
    setDate(new Date());
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const el = document.getElementById('admin-now-line');
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 60);
    }
  };

  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      return { start: startOfDay(weekStart).toISOString(), end: endOfDay(weekEnd).toISOString() };
    }
    return { start: startOfDay(date).toISOString(), end: endOfDay(date).toISOString() };
  }, [date, viewMode]);

  const { bookings, loading, refetch, cancelBooking, completeBooking, noShowBooking } = useBookings(salon?.id, dateRange);
  const bookingParam = searchParams.get('booking');
  const { services } = useServices(salon?.id);
  const { staff } = useStaff(salon?.id);
  const { canEditStaff, canSeeRevenue } = useAuth();

  const filteredBookings = bookings;

  const handleCancel = async (id: string) => {
    try { await cancelBooking(id); addToast('success', 'Afspraak geannuleerd'); } catch { addToast('error', 'Annulering mislukt'); }
  };

  const handleNoShow = async (id: string) => {
    try { await noShowBooking(id); addToast('success', 'No-show geregistreerd'); } catch { addToast('error', 'Kon no-show niet registreren'); }
  };

  const handleComplete = async (id: string) => {
    try { await completeBooking(id); addToast('success', 'Afspraak voltooid'); } catch { addToast('error', 'Kon status niet bijwerken'); }
  };

  const handleSlotClick = (staffId: string, time: string) => {
    setCreatePrefill({ staffId, time });
    setShowCreateModal(true);
  };

  const handleBookingCreated = () => { addToast('success', 'Afspraak aangemaakt'); refetch(); };

  const selectedService = selectedBooking ? services.find(s => s.id === selectedBooking.service_id) || null : null;
  const selectedStaff = selectedBooking ? staff.find(s => s.id === selectedBooking.staff_id) || null : null;
  const slotStepMinutes = (salon as any)?.slot_step_minutes ?? 15;

  useEffect(() => {
    if (!bookingParam || bookings.length === 0) return;
    if (selectedBooking?.id === bookingParam) return;
    const found = bookings.find(b => b.id === bookingParam);
    if (found) setSelectedBooking(found);
  }, [bookingParam, bookings, selectedBooking]);

  useEffect(() => {
    if (viewMode !== 'day') {
      setSelectedIds([]);
      return;
    }
    const visible = new Set(filteredBookings.map(b => b.id));
    setSelectedIds(prev => prev.filter(id => visible.has(id)));
  }, [filteredBookings, viewMode]);

  const selectedCount = selectedIds.length;

  const statusLegend = [
    { label: 'Bezet', className: 'bg-[#EEF2F7] text-[#22324A] border border-[#3B4E6C]/40' },
    { label: 'Pending', className: 'bg-amber-50 text-amber-800 border border-amber-200' },
    { label: 'No-show', className: 'bg-rose-50 text-rose-700 border border-rose-200' },
    { label: 'Geannuleerd', className: 'bg-gray-50 text-gray-500 border border-gray-200' },
    { label: 'Vrij', className: 'bg-white text-gray-400 border border-dashed border-gray-200' },
  ];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedCount === filteredBookings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBookings.map(b => b.id));
    }
  };

  const runBulk = async (action: 'cancel' | 'complete' | 'no_show') => {
    if (selectedCount === 0) return;
    setBulkAction(action);
    const targets = filteredBookings.filter(b => selectedIds.includes(b.id));

    const tasks = targets.map(async (b) => {
      if (action === 'cancel' && b.status === 'cancelled') return;
      if (action === 'complete' && b.status === 'completed') return;
      if (action === 'no_show' && b.status === 'no_show') return;
      if (action === 'cancel') return handleCancel(b.id);
      if (action === 'complete') return handleComplete(b.id);
      return handleNoShow(b.id);
    });

    await Promise.allSettled(tasks);
    setSelectedIds([]);
    setBulkAction(null);
    refetch();
  };

  // Week view grouping
  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [date, viewMode]);

  const bookingsByDay = useMemo(() => {
    if (viewMode !== 'week') return new Map();
    const map = new Map<string, Booking[]>();
    for (const day of weekDays) {
      const key = format(day, 'yyyy-MM-dd');
      map.set(key, filteredBookings.filter(b => isSameDay(new Date(b.start_at), day)));
    }
    return map;
  }, [filteredBookings, weekDays, viewMode]);

  return (
    <div>
      {/* Combined Header & Controls */}
      <div className="sticky top-3 z-30 mb-2">
        <div className="bg-white/95 backdrop-blur border border-gray-200/70 rounded-2xl px-3 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
          {/* Top row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-1.5">
            <div className="flex items-center justify-between lg:justify-start w-full lg:w-auto gap-2">
              <h2 className="text-[15px] lg:text-[17px] font-bold text-gray-900 tracking-tight whitespace-nowrap">Boekingen</h2>
              <div className="hidden sm:flex rounded-xl bg-gray-100/70 p-0.5">
                {(['agenda', 'day', 'week'] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-[10px] transition-all ${
                      viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === 'agenda' ? 'Agenda' : mode === 'day' ? 'Lijst' : 'Week'}
                  </button>
                ))}
              </div>
              <div className="sm:hidden">
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as ViewMode)}
                  className="px-2.5 py-1.5 text-[11px] font-semibold rounded-xl border border-gray-200 bg-white"
                >
                  <option value="agenda">Agenda</option>
                  <option value="day">Lijst</option>
                  <option value="week">Week</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between lg:justify-end w-full lg:w-auto gap-1.5 mt-0">
              {viewMode === 'week' ? (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setDate(d => subWeeks(d, 1))} className="p-1 rounded-md hover:bg-gray-100 text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-[11px] font-medium text-gray-700 min-w-[112px] text-center">
                    {format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: nl })} – {format(endOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: nl })}
                  </span>
                  <button onClick={() => setDate(d => addWeeks(d, 1))} className="p-1 rounded-md hover:bg-gray-100 text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button onClick={handleNow} className="px-2 py-0.5 text-[10px] font-medium text-gray-900 bg-gray-100 rounded-md">Nu</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <DateNavigator date={date} onChange={setDate} />
                  <button onClick={handleNow} className="px-2 py-0.5 text-[10px] font-medium text-gray-900 bg-gray-100 rounded-md">Nu</button>
                </div>
              )}
              <button
                onClick={() => { setCreatePrefill({}); setShowCreateModal(true); }}
                className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold bg-gray-900 text-white rounded-xl hover:bg-black transition-colors shadow-[0_10px_20px_rgba(15,23,42,0.18)] whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Nieuwe afspraak</span>
              </button>
            </div>
          </div>

          {(viewMode === 'agenda' || viewMode === 'week') && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {statusLegend.map(item => (
                <span key={item.label} className={`px-2.5 py-1 text-[10px] font-semibold rounded-full ${item.className}`}>
                  {item.label}
                </span>
              ))}
            </div>
          )}

          {/* Bulk actions */}
          {viewMode === 'day' && selectedCount > 0 && (
            <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <div className="text-[12px] font-semibold text-gray-700">{selectedCount} geselecteerd</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => runBulk('complete')}
                  disabled={bulkAction !== null}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Voltooid
                </button>
                <button
                  onClick={() => runBulk('no_show')}
                  disabled={bulkAction !== null}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  No-show
                </button>
                <button
                  onClick={() => runBulk('cancel')}
                  disabled={bulkAction !== null}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-60"
                >
                  Annuleer
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  Deselecteer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Spinner className="py-12" />
      ) : viewMode === 'agenda' ? (
        salon && (
          <Suspense fallback={<Spinner className="py-12" />}>
            <AgendaView
              date={date}
              bookings={filteredBookings}
              services={services}
              staff={staff}
              timezone={salon.timezone}
              slotStepMinutes={slotStepMinutes}
              onSelectBooking={setSelectedBooking}
              onSlotClick={handleSlotClick}
              onBookingMoved={() => { addToast('success', 'Afspraak verplaatst'); refetch(); }}
            />
          </Suspense>
        )
      ) : viewMode === 'day' ? (
        <BookingList
          bookings={filteredBookings}
          services={services}
          staff={staff}
          onSelect={setSelectedBooking}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleSelectAll}
        />
      ) : salon ? (
        <Suspense fallback={<Spinner className="py-12" />}>
          <WeekAgendaView
            date={date}
            bookings={filteredBookings}
            services={services}
            staff={staff}
            timezone={salon.timezone}
            slotStepMinutes={slotStepMinutes}
            onSelectBooking={setSelectedBooking}
            onSlotClick={handleSlotClick}
          />
        </Suspense>
      ) : null}

      <BookingDetailModal
        booking={selectedBooking}
        service={selectedService}
        staff={selectedStaff}
        allServices={services}
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCancel={handleCancel}
        onNoShow={handleNoShow}
        onComplete={handleComplete}
        canEdit={selectedBooking ? canEditStaff(selectedBooking.staff_id) : false}
        canSeeRevenue={canSeeRevenue}
      />

      {salon && (
        <CreateBookingModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleBookingCreated}
          salon={salon}
          services={services}
          staff={staff}
          slotStepMinutes={slotStepMinutes}
          prefillDate={date}
          prefillStaffId={createPrefill.staffId}
          prefillTime={createPrefill.time}
        />
      )}

      {/* Mobile FAB */}
      <AdminFab
        label="Nieuwe afspraak"
        onClick={() => { setCreatePrefill({}); setShowCreateModal(true); }}
      />
    </div>
  );
}
