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
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Booking } from '../../lib/types';

type ViewMode = 'day' | 'week';

export function BookingsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { addToast } = useToast();
  const [date, setDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

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
    try {
      await cancelBooking(id);
      addToast('success', 'Afspraak geannuleerd');
    } catch {
      addToast('error', 'Annulering mislukt');
    }
  };

  const handleNoShow = async (id: string) => {
    try {
      await supabase
        .from('bookings')
        .update({ status: 'no_show' })
        .eq('id', id);
      addToast('success', 'No-show geregistreerd');
      refetch();
    } catch {
      addToast('error', 'Kon no-show niet registreren');
    }
  };

  const selectedService = selectedBooking
    ? services.find(s => s.id === selectedBooking.service_id) || null
    : null;
  const selectedStaff = selectedBooking
    ? staff.find(s => s.id === selectedBooking.staff_id) || null
    : null;

  // Week view: group bookings by day
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
  const totalRevenue = confirmed.reduce((sum, b) => {
    const svc = services.find(s => s.id === b.service_id);
    return sum + (svc?.price_cents || 0);
  }, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Boekingen</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'day' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setViewMode('day')}
            >
              Dag
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Date navigation */}
      <div className="mb-4">
        {viewMode === 'day' ? (
          <DateNavigator date={date} onChange={setDate} />
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDate(d => subWeeks(d, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-gray-700">
              {format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: nl })} – {format(endOfWeek(date, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: nl })}
            </span>
            <button
              onClick={() => setDate(d => addWeeks(d, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button
              onClick={() => setDate(new Date())}
              className="ml-2 px-3 py-1 text-xs font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100"
            >
              Deze week
            </button>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{confirmed.length}</p>
          <p className="text-xs text-gray-500">Bevestigd</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingPayment.length}</p>
          <p className="text-xs text-gray-500">Wacht op betaling</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">€{(totalRevenue / 100).toFixed(0)}</p>
          <p className="text-xs text-gray-500">Omzet</p>
        </div>
      </div>

      {loading ? (
        <Spinner className="py-12" />
      ) : viewMode === 'day' ? (
        <BookingList
          bookings={bookings}
          services={services}
          staff={staff}
          onSelect={setSelectedBooking}
        />
      ) : (
        /* Week view */
        <div className="space-y-4">
          {weekDays.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDay.get(key) || [];
            const isToday = isSameDay(day, new Date());

            return (
              <div key={key}>
                <div className={`flex items-center gap-2 mb-2 ${isToday ? 'text-violet-700' : 'text-gray-600'}`}>
                  <span className={`text-sm font-semibold ${isToday ? 'bg-violet-600 text-white px-2 py-0.5 rounded-full' : ''}`}>
                    {format(day, 'EEEE d MMM', { locale: nl })}
                  </span>
                  <span className="text-xs text-gray-400">{dayBookings.length} afspraken</span>
                </div>
                {dayBookings.length > 0 ? (
                  <BookingList
                    bookings={dayBookings}
                    services={services}
                    staff={staff}
                    onSelect={setSelectedBooking}
                  />
                ) : (
                  <p className="text-xs text-gray-400 py-2 pl-2">Geen afspraken</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <BookingDetailModal
        booking={selectedBooking}
        service={selectedService}
        staff={selectedStaff}
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCancel={handleCancel}
        onNoShow={handleNoShow}
      />
    </div>
  );
}
