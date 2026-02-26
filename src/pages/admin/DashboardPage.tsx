import { useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { format, startOfDay, endOfDay } from 'date-fns';
import { nl } from 'date-fns/locale';
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

  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const pending = bookings.filter(b => b.status === 'pending_payment');
  const revenue = confirmed.reduce((sum, b) => {
    const svc = services.find(s => s.id === b.service_id);
    return sum + (svc?.price_cents || 0);
  }, 0);
  const paidOnline = confirmed.reduce((sum, b) => sum + (b.amount_paid_cents || 0), 0);

  if (loading) return <Spinner className="py-12" />;

  const greeting = today.getHours() < 12 ? 'Goedemorgen' : today.getHours() < 18 ? 'Goedemiddag' : 'Goedenavond';

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(today, 'EEEE d MMMM yyyy', { locale: nl })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{confirmed.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Afspraken vandaag</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">€{(revenue / 100).toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Verwachte omzet</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">€{(paidOnline / 100).toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Online betaald</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Wacht op betaling</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <Link
          to="/admin/bookings"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Agenda openen
        </Link>
        <Link
          to="/admin/customers"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
        >
          Klanten bekijken
        </Link>
      </div>

      {/* Upcoming appointments */}
      {confirmed.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Eerstvolgende afspraken</h2>
            <Link to="/admin/bookings" className="text-xs text-violet-600 font-medium hover:underline">
              Alles bekijken
            </Link>
          </div>
          <div className="space-y-2">
            {confirmed.slice(0, 5).map(b => {
              const service = services.find(s => s.id === b.service_id);
              const member = staff.find(s => s.id === b.staff_id);
              const priceCents = b.amount_total_cents || service?.price_cents || 0;

              return (
                <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3">
                  {/* Time */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <p className="text-sm font-bold text-gray-900">{format(new Date(b.start_at), 'HH:mm')}</p>
                  </div>
                  {/* Divider */}
                  <div className="w-px h-8 bg-gray-100 flex-shrink-0" />
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.customer_name}</p>
                    <p className="text-xs text-gray-500 truncate">{service?.name} · {member?.name}</p>
                  </div>
                  {/* Price */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-medium text-gray-700">€{(priceCents / 100).toFixed(2).replace('.', ',')}</p>
                    {b.amount_paid_cents > 0 && (
                      <p className="text-[10px] text-emerald-600">betaald</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {confirmed.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 text-sm">Geen afspraken vandaag</p>
          <Link to="/admin/bookings" className="text-violet-600 text-sm font-medium hover:underline mt-1 inline-block">
            Bekijk de agenda
          </Link>
        </div>
      )}
    </div>
  );
}
