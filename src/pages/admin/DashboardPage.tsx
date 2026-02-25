import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useBookings } from '../../hooks/useBookings';
import { useServices } from '../../hooks/useServices';
import { useStaff } from '../../hooks/useStaff';
import { Spinner } from '../../components/ui/Spinner';
import type { Salon } from '../../lib/types';

export function DashboardPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const today = useMemo(() => new Date(), []);
  const dateRange = useMemo(() => ({
    start: startOfDay(today).toISOString(),
    end: endOfDay(today).toISOString(),
  }), [today]);

  const { bookings, loading } = useBookings(salon?.id, dateRange);
  const { services } = useServices(salon?.id);
  const { staff } = useStaff(salon?.id);

  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const revenue = confirmed.reduce((sum, b) => {
    const service = services.find((s) => s.id === b.service_id);
    return sum + (service?.price_cents || 0);
  }, 0);

  if (loading) return <Spinner className="py-12" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Afspraken vandaag</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{confirmed.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Verwachte omzet</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">€{(revenue / 100).toFixed(2).replace('.', ',')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Medewerkers actief</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{staff.filter((s) => s.is_active).length}</p>
        </div>
      </div>

      {confirmed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Volgende afspraken</h2>
          <div className="space-y-2">
            {confirmed.slice(0, 5).map((b) => {
              const service = services.find((s) => s.id === b.service_id);
              const member = staff.find((s) => s.id === b.staff_id);
              return (
                <div key={b.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{format(new Date(b.start_at), 'HH:mm')}</span>
                    <span className="text-gray-500 mx-2">·</span>
                    <span>{b.customer_name}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {service?.name} · {member?.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
