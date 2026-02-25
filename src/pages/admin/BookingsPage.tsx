import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { startOfDay, endOfDay } from 'date-fns';
import { useBookings } from '../../hooks/useBookings';
import { useServices } from '../../hooks/useServices';
import { useStaff } from '../../hooks/useStaff';
import { DateNavigator } from '../../components/admin/DateNavigator';
import { BookingList } from '../../components/admin/BookingList';
import { Spinner } from '../../components/ui/Spinner';
import type { Salon } from '../../lib/types';

export function BookingsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const [date, setDate] = useState(new Date());

  const dateRange = useMemo(() => ({
    start: startOfDay(date).toISOString(),
    end: endOfDay(date).toISOString(),
  }), [date]);

  const { bookings, loading, cancelBooking } = useBookings(salon?.id, dateRange);
  const { services } = useServices(salon?.id);
  const { staff } = useStaff(salon?.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Boekingen</h1>
      </div>
      <div className="mb-6">
        <DateNavigator date={date} onChange={setDate} />
      </div>
      {loading ? (
        <Spinner className="py-12" />
      ) : (
        <BookingList bookings={bookings} services={services} staff={staff} onCancel={cancelBooking} />
      )}
    </div>
  );
}
