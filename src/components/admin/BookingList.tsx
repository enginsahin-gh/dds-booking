import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '../ui/Button';
import type { Booking, Service, Staff } from '../../lib/types';

interface BookingListProps {
  bookings: Booking[];
  services: Service[];
  staff: Staff[];
  onCancel: (id: string) => void;
}

export function BookingList({ bookings, services, staff, onCancel }: BookingListProps) {
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
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {bookings.map((booking) => {
            const service = services.find((s) => s.id === booking.service_id);
            const member = staff.find((s) => s.id === booking.staff_id);
            const start = parseISO(booking.start_at);

            return (
              <tr key={booking.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{format(start, 'HH:mm')}</td>
                <td className="px-4 py-3">
                  <div>{booking.customer_name}</div>
                  <div className="text-xs text-gray-400">{booking.customer_phone}</div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">{service?.name || '-'}</td>
                <td className="px-4 py-3 hidden md:table-cell">{member?.name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    booking.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {booking.status === 'confirmed' ? 'Bevestigd' : 'Geannuleerd'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {booking.status === 'confirmed' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (confirm('Weet je zeker dat je deze afspraak wilt annuleren?')) {
                          onCancel(booking.id);
                        }
                      }}
                    >
                      Annuleer
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
