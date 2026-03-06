import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, format, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';
import { useBookings } from '../../hooks/useBookings';
import { useServices } from '../../hooks/useServices';
import { useStaff } from '../../hooks/useStaff';
import { DateNavigator } from '../../components/admin/DateNavigator';
import { BookingList } from '../../components/admin/BookingList';
import { BookingDetailModal } from '../../components/admin/BookingDetailModal';
import { AgendaView } from '../../components/admin/AgendaView';
import { WeekAgendaView } from '../../components/admin/WeekAgendaView';
import { CreateBookingModal } from '../../components/admin/CreateBookingModal';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Booking } from '../../lib/types';

type ViewMode = 'day' | 'week' | 'agenda';

export function BookingsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { addToast } = useToast();
  const [date, setDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('agenda');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ staffId?: string; time?: string }>({});

  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      return { start: startOfDay(weekStart).toISOString(), end: endOfDay(weekEnd).toISOString() };
    }
    return { start: startOfDay(date).toISOString(), end: endOfDay(date).toISOString() };
  }, [date, viewMode]);

  const { bookings, loading, refetch, cancelBooking, completeBooking, noShowBooking } = useBookings(salon?.id, dateRange);
  const { services } = useServices(salon?.id);
  const { staff } = useStaff(salon?.id);
  const { canEditStaff, canSeeRevenue } = useAuth();

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
      map.set(key, bookings.filter(b => isSameDay(new Date(b.start_at), day)));
    }
    return map;
  }, [bookings, weekDays, viewMode]);

  return (
    <div>
      {/* Combined Header & Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 bg-white border border-gray-200/70 rounded-2xl px-2.5 py-2 lg:px-3 lg:py-2.5 mb-2 lg:mb-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
        {/* Left Section: Title & View Mode Tabs */}
        <div className="flex items-center justify-between lg:justify-start w-full lg:w-auto gap-2">
          <h2 className="text-base lg:text-lg font-bold text-gray-900 tracking-tight whitespace-nowrap">Boekingen</h2>
          <div className="flex rounded-xl bg-gray-100/70 p-0.5">
            {(['agenda', 'day', 'week'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                className={`px-3 py-1.5 text-xs font-medium rounded-[10px] transition-all ${
                  viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'agenda' ? 'Agenda' : mode === 'day' ? 'Lijst' : 'Week'}
              </button>
            ))}
          </div>
        </div>

        {/* Right Section: Date Navigation & New Appointment Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between lg:justify-end w-full lg:w-auto gap-2 mt-0">
          {viewMode === 'week' ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setDate(d => subWeeks(d, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-xs font-medium text-gray-700 min-w-[120px] text-center">
                {format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: nl })} – {format(endOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: nl })}
              </span>
              <button onClick={() => setDate(d => addWeeks(d, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => setDate(new Date())} className="px-2.5 py-1 text-[10px] font-medium text-gray-900 bg-gray-100 rounded-lg">Nu</button>
            </div>
          ) : (
            <DateNavigator date={date} onChange={setDate} />
          )}
          <button
            onClick={() => { setCreatePrefill({}); setShowCreateModal(true); }}
            className="hidden lg:inline-flex items-center gap-2 px-3.5 py-2 lg:px-4 text-sm font-medium bg-gray-900 text-white rounded-xl hover:bg-black transition-colors shadow-[0_10px_20px_rgba(15,23,42,0.18)] whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nieuwe afspraak</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Spinner className="py-12" />
      ) : viewMode === 'agenda' ? (
        salon && (
          <AgendaView
            date={date}
            bookings={bookings}
            services={services}
            staff={staff}
            timezone={salon.timezone}
            slotStepMinutes={slotStepMinutes}
            onSelectBooking={setSelectedBooking}
            onSlotClick={handleSlotClick}
            onBookingMoved={() => { addToast('success', 'Afspraak verplaatst'); refetch(); }}
          />
        )
      ) : viewMode === 'day' ? (
        <BookingList bookings={bookings} services={services} staff={staff} onSelect={setSelectedBooking} />
      ) : salon ? (
        <WeekAgendaView
          date={date}
          bookings={bookings}
          services={services}
          staff={staff}
          timezone={salon.timezone}
          slotStepMinutes={slotStepMinutes}
          onSelectBooking={setSelectedBooking}
          onSlotClick={handleSlotClick}
        />
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
      <button
        onClick={() => { setCreatePrefill({}); setShowCreateModal(true); }}
        className="lg:hidden fixed right-4 bottom-24 w-12 h-12 rounded-full bg-gray-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.28)] flex items-center justify-center z-40"
        aria-label="Nieuwe afspraak"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
