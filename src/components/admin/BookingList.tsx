import { format, parseISO } from 'date-fns';
import type { Booking, Service, Staff } from '../../lib/types';

interface BookingListProps {
  bookings: Booking[];
  services: Service[];
  staff: Staff[];
  onSelect: (booking: Booking) => void;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    pending_payment: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-100 text-gray-700',
  };
  const labels: Record<string, string> = {
    confirmed: 'Bevestigd',
    pending_payment: 'Wacht op betaling',
    cancelled: 'Geannuleerd',
    no_show: 'No-show',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

function PaymentBadge({ booking }: { booking: Booking }) {
  if (booking.payment_type === 'none' || booking.payment_status === 'none') return null;

  const styles: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-600',
    paid: 'bg-emerald-50 text-emerald-600',
    failed: 'bg-red-50 text-red-600',
    refunded: 'bg-blue-50 text-blue-600',
  };
  const labels: Record<string, string> = {
    pending: '⏳',
    paid: '💳',
    failed: '❌',
    refunded: '↩️',
  };
  const tooltips: Record<string, string> = {
    pending: 'Wacht op betaling',
    paid: `Betaald: €${((booking.amount_paid_cents || 0) / 100).toFixed(2).replace('.', ',')}`,
    failed: 'Betaling mislukt',
    refunded: 'Terugbetaald',
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${styles[booking.payment_status] || ''}`}
      title={tooltips[booking.payment_status] || ''}
    >
      {labels[booking.payment_status] || ''}
    </span>
  );
}

export function BookingList({ bookings, services, staff, onSelect }: BookingListProps) {
  if (!bookings.length) {
    return <p className="text-gray-500 text-sm py-8 text-center">Geen boekingen gevonden</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Tijd</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Klant</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Dienst</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Medewerker</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Betaling</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {bookings.map((booking) => {
            const service = services.find((s) => s.id === booking.service_id);
            const member = staff.find((s) => s.id === booking.staff_id);
            const start = parseISO(booking.start_at);
            const end = parseISO(booking.end_at);
            const priceCents = booking.amount_total_cents || service?.price_cents || 0;

            return (
              <tr
                key={booking.id}
                className="hover:bg-violet-50 cursor-pointer transition-colors"
                onClick={() => onSelect(booking)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{format(start, 'HH:mm')}</div>
                  <div className="text-xs text-gray-400">{format(end, 'HH:mm')}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{booking.customer_name}</div>
                  <div className="text-xs text-gray-400">{booking.customer_phone}</div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div>{service?.name || '-'}</div>
                  <div className="text-xs text-gray-400">€{(priceCents / 100).toFixed(2).replace('.', ',')}</div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">{member?.name || '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <PaymentBadge booking={booking} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
