import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, format, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useBookings } from '../../hooks/useBookings';
import { useServices } from '../../hooks/useServices';
import { useStaff } from '../../hooks/useStaff';
import { DateNavigator } from '../../components/admin/DateNavigator';
import { BookingList } from '../../components/admin/BookingList';
import { BookingDetailModal } from '../../components/admin/BookingDetailModal';
import { AgendaView } from '../../components/admin/AgendaView';
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

  const { bookings, loading, refetch, cancelBooking } = useBookings(salon?.id, dateRange);
  const { services } = useServices(salon?.id);
  const { staff } = useStaff(salon?.id);

  const handleCancel = async (id: string) => {
    try { await cancelBooking(id); addToast('success', 'Afspraak geannuleerd'); } catch { addToast('error', 'Annulering mislukt'); }
  };

  const handleNoShow = async (id: string) => {
    try {
      await supabase.from('bookings').update({ status: 'no_show' }).eq('id', id);
      addToast('success', 'No-show geregistreerd');
      refetch();
    } catch { addToast('error', 'Kon no-show niet registreren'); }
  };

  const handleSlotClick = (staffId: string, time: string) => {
    setCreatePrefill({ staffId, time });
    setShowCreateModal(true);
  };

  const handleBookingCreated = () => { addToast('success', 'Afspraak aangemaakt'); refetch(); };

  const selectedService = selectedBooking ? services.find(s => s.id === selectedBooking.service_id) || null : null;
  const selectedStaff = selectedBooking ? staff.find(s => s.id === selectedBooking.staff_id) || null : null;

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

  // Stats
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const pendingPayment = bookings.filter(b => b.status === 'pending_payment');
  const totalRevenue = confirmed.reduce((sum, b) => sum + (services.find(s => s.id === b.service_id)?.price_cents || 0), 0);

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Boekingen</h1>
          <button
            onClick={() => { setCreatePrefill({}); setShowCreateModal(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 lg:px-4 text-sm font-medium bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nieuwe afspraak</span>
          </button>
        </div>

        {/* View toggle + date nav */}
        <div className="flex items-center justify-between gap-3">
          {/* View mode */}
          <div className="flex rounded-xl bg-gray-100 p-0.5">
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

          {/* Date nav */}
          {viewMode === 'week' ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setDate(d => subWeeks(d, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-xs font-medium text-gray-600 min-w-[120px] text-center">
                {format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: nl })} – {format(endOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: nl })}
              </span>
              <button onClick={() => setDate(d => addWeeks(d, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => setDate(new Date())} className="px-2 py-1 text-[10px] font-medium text-violet-600 bg-violet-50 rounded-lg">Nu</button>
            </div>
          ) : (
            <DateNavigator date={date} onChange={setDate} />
          )}
        </div>
      </div>

      {/* Quick stats - compact on mobile */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-2.5 lg:p-3 text-center">
          <p className="text-lg lg:text-2xl font-bold text-gray-900">{confirmed.length}</p>
          <p className="text-[10px] lg:text-xs text-gray-500">Bevestigd</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-2.5 lg:p-3 text-center">
          <p className="text-lg lg:text-2xl font-bold text-amber-600">{pendingPayment.length}</p>
          <p className="text-[10px] lg:text-xs text-gray-500">Wacht</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-2.5 lg:p-3 text-center">
          <p className="text-lg lg:text-2xl font-bold text-gray-900">€{(totalRevenue / 100).toFixed(0)}</p>
          <p className="text-[10px] lg:text-xs text-gray-500">Omzet</p>
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
            onSelectBooking={setSelectedBooking}
            onSlotClick={handleSlotClick}
            onBookingMoved={() => { addToast('success', 'Afspraak verplaatst'); refetch(); }}
          />
        )
      ) : viewMode === 'day' ? (
        <BookingList bookings={bookings} services={services} staff={staff} onSelect={setSelectedBooking} />
      ) : (
        <div className="space-y-4">
          {weekDays.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDay.get(key) || [];
            const isToday = isSameDay(day, new Date());
            return (
              <div key={key}>
                <div className={`flex items-center gap-2 mb-2 ${isToday ? 'text-violet-700' : 'text-gray-600'}`}>
                  <span className={`text-sm font-semibold ${isToday ? 'bg-violet-600 text-white px-2 py-0.5 rounded-full' : ''}`}>
                    {format(day, 'EEE d MMM', { locale: nl })}
                  </span>
                  <span className="text-xs text-gray-400">{dayBookings.length}</span>
                </div>
                {dayBookings.length > 0 ? (
                  <BookingList bookings={dayBookings} services={services} staff={staff} onSelect={setSelectedBooking} />
                ) : (
                  <p className="text-xs text-gray-400 py-2 pl-2">Geen afspraken</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BookingDetailModal
        booking={selectedBooking}
        service={selectedService}
        staff={selectedStaff}
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCancel={handleCancel}
        onNoShow={handleNoShow}
      />

      {salon && (
        <CreateBookingModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleBookingCreated}
          salon={salon}
          services={services}
          staff={staff}
          prefillDate={date}
          prefillStaffId={createPrefill.staffId}
          prefillTime={createPrefill.time}
        />
      )}
    </div>
  );
}
