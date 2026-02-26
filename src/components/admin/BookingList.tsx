import { format, parseISO } from 'date-fns';
import type { Booking, Service, Staff } from '../../lib/types';

interface BookingListProps {
  bookings: Booking[];
  services: Service[];
  staff: Staff[];
  onSelect: (booking: Booking) => void;
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Bevestigd' },
  pending_payment: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Wacht op betaling' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600', label: 'Geannuleerd' },
  no_show: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'No-show' },
};

const paymentIcons: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'text-amber-500', label: 'Wacht op betaling' },
  paid: { icon: '●', color: 'text-emerald-500', label: 'Betaald' },
  failed: { icon: '●', color: 'text-red-500', label: 'Mislukt' },
  refunded: { icon: '↺', color: 'text-blue-500', label: 'Terugbetaald' },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusStyles[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export function BookingList({ bookings, services, staff, onSelect }: BookingListProps) {
  if (!bookings.length) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 mx-auto text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-400 text-sm">Geen boekingen</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: card layout */}
      <div className="space-y-2 md:hidden">
        {bookings.map((booking) => {
          const service = services.find(s => s.id === booking.service_id);
          const member = staff.find(s => s.id === booking.staff_id);
          const start = parseISO(booking.start_at);
          const end = parseISO(booking.end_at);
          const priceCents = booking.amount_total_cents || service?.price_cents || 0;
          const pi = booking.payment_status !== 'none' ? paymentIcons[booking.payment_status] : null;

          return (
            <div
              key={booking.id}
              onClick={() => onSelect(booking)}
              className="bg-white rounded-xl border border-gray-100 p-3.5 active:bg-violet-50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Time block */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <p className="text-sm font-bold text-gray-900">{format(start, 'HH:mm')}</p>
                    <p className="text-[10px] text-gray-400">{format(end, 'HH:mm')}</p>
                  </div>
                  {/* Info */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{booking.customer_name}</p>
                    <p className="text-xs text-gray-500 truncate">{service?.name || '-'}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{member?.name || '-'}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <StatusBadge status={booking.status} />
                  <div className="flex items-center gap-1.5">
                    {pi && <span className={`text-xs ${pi.color}`} title={pi.label}>{pi.icon}</span>}
                    <span className="text-xs font-medium text-gray-500">€{(priceCents / 100).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Tijd</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Klant</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Dienst</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Medewerker</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Prijs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {bookings.map((booking) => {
              const service = services.find(s => s.id === booking.service_id);
              const member = staff.find(s => s.id === booking.staff_id);
              const start = parseISO(booking.start_at);
              const end = parseISO(booking.end_at);
              const priceCents = booking.amount_total_cents || service?.price_cents || 0;
              const pi = booking.payment_status !== 'none' ? paymentIcons[booking.payment_status] : null;

              return (
                <tr
                  key={booking.id}
                  className="hover:bg-violet-50/50 cursor-pointer transition-colors"
                  onClick={() => onSelect(booking)}
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">{format(start, 'HH:mm')}</span>
                    <span className="text-gray-300 mx-1">-</span>
                    <span className="text-gray-400">{format(end, 'HH:mm')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{booking.customer_name}</p>
                    {booking.customer_phone && <p className="text-xs text-gray-400">{booking.customer_phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{service?.name || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{member?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={booking.status} />
                      {pi && <span className={`text-xs ${pi.color}`} title={pi.label}>{pi.icon}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">
                    €{(priceCents / 100).toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
