import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import type { Salon, Booking, Service, Staff } from '../../lib/types';

interface Customer {
  email: string;
  name: string;
  phone: string;
  totalBookings: number;
  totalSpentCents: number;
  totalPaidCents: number;
  lastVisit: string;
  firstVisit: string;
  noShows: number;
  cancellations: number;
  bookings: Booking[];
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export function CustomersPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sortBy, setSortBy] = useState<'lastVisit' | 'totalSpent' | 'totalBookings'>('lastVisit');

  useEffect(() => {
    if (!salon) return;
    const load = async () => {
      const [bookingsRes, servicesRes, staffRes] = await Promise.all([
        supabase.from('bookings').select('*').eq('salon_id', salon.id).order('start_at', { ascending: false }),
        supabase.from('services').select('*').eq('salon_id', salon.id),
        supabase.from('staff').select('*').eq('salon_id', salon.id),
      ]);
      setBookings(bookingsRes.data || []);
      setServices(servicesRes.data || []);
      setStaffList(staffRes.data || []);
      setLoading(false);
    };
    load();
  }, [salon]);

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();

    for (const b of bookings) {
      const key = b.customer_email.toLowerCase();
      let c = map.get(key);
      if (!c) {
        c = {
          email: b.customer_email,
          name: b.customer_name,
          phone: b.customer_phone || '',
          totalBookings: 0,
          totalSpentCents: 0,
          totalPaidCents: 0,
          lastVisit: b.start_at,
          firstVisit: b.start_at,
          noShows: 0,
          cancellations: 0,
          bookings: [],
        };
        map.set(key, c);
      }

      c.bookings.push(b);
      c.totalBookings++;
      c.name = b.customer_name || c.name;
      c.phone = b.customer_phone || c.phone;

      const svc = services.find(s => s.id === b.service_id);
      if (b.status === 'confirmed') {
        c.totalSpentCents += svc?.price_cents || 0;
      }
      c.totalPaidCents += b.amount_paid_cents || 0;

      if (b.status === 'no_show') c.noShows++;
      if (b.status === 'cancelled') c.cancellations++;

      if (b.start_at > c.lastVisit) c.lastVisit = b.start_at;
      if (b.start_at < c.firstVisit) c.firstVisit = b.start_at;
    }

    let list = Array.from(map.values());

    // Filter
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'lastVisit') return b.lastVisit.localeCompare(a.lastVisit);
      if (sortBy === 'totalSpent') return b.totalSpentCents - a.totalSpentCents;
      return b.totalBookings - a.totalBookings;
    });

    return list;
  }, [bookings, services, search, sortBy]);

  if (loading) return <Spinner className="py-12" />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klanten</h1>
          <p className="text-sm text-gray-500 mt-1">{customers.length} klanten</p>
        </div>
      </div>

      {/* Search & sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Zoek op naam, email of telefoon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="lastVisit">Laatste bezoek</option>
          <option value="totalSpent">Meeste omzet</option>
          <option value="totalBookings">Meeste boekingen</option>
        </select>
      </div>

      {/* Customer list */}
      {customers.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Geen klanten gevonden</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Klant</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Boekingen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Omzet</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Laatste bezoek</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Betaald</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(customer => (
                <tr
                  key={customer.email}
                  className="hover:bg-violet-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-xs text-gray-400">{customer.email}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-medium">{customer.totalBookings}</span>
                    {customer.noShows > 0 && (
                      <span className="ml-2 text-xs text-red-500">{customer.noShows} no-show</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell font-medium">
                    {formatPrice(customer.totalSpentCents)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                    {format(parseISO(customer.lastVisit), 'd MMM yyyy', { locale: nl })}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-green-600 font-medium">
                    {customer.totalPaidCents > 0 ? formatPrice(customer.totalPaidCents) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer detail modal */}
      {selectedCustomer && (
        <Modal
          open={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={selectedCustomer.name}
        >
          <div className="space-y-5">
            {/* Contact info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</label>
                <p className="text-sm mt-1">
                  <a href={`mailto:${selectedCustomer.email}`} className="text-violet-600 hover:underline">{selectedCustomer.email}</a>
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Telefoon</label>
                <p className="text-sm mt-1">
                  <a href={`tel:${selectedCustomer.phone}`} className="text-violet-600 hover:underline">{selectedCustomer.phone}</a>
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-900">{selectedCustomer.totalBookings}</p>
                <p className="text-xs text-gray-500">Boekingen</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-900">{formatPrice(selectedCustomer.totalSpentCents)}</p>
                <p className="text-xs text-gray-500">Totale omzet</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-600">{formatPrice(selectedCustomer.totalPaidCents)}</p>
                <p className="text-xs text-gray-500">Online betaald</p>
              </div>
            </div>

            {selectedCustomer.noShows > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
                {selectedCustomer.noShows}x no-show · {selectedCustomer.cancellations}x geannuleerd
              </div>
            )}

            {/* Booking history */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Geschiedenis</label>
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {selectedCustomer.bookings.map(b => {
                  const svc = services.find(s => s.id === b.service_id);
                  const stf = staffList.find(s => s.id === b.staff_id);
                  const statusColors: Record<string, string> = {
                    confirmed: 'text-green-600',
                    pending_payment: 'text-yellow-600',
                    cancelled: 'text-red-500',
                    no_show: 'text-gray-500',
                  };
                  const statusLabels: Record<string, string> = {
                    confirmed: 'Bevestigd',
                    pending_payment: 'Wacht op betaling',
                    cancelled: 'Geannuleerd',
                    no_show: 'No-show',
                  };
                  return (
                    <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">{svc?.name || '-'}</div>
                        <div className="text-xs text-gray-400">
                          {format(parseISO(b.start_at), 'd MMM yyyy HH:mm', { locale: nl })} · {stf?.name || '-'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatPrice(svc?.price_cents || 0)}</div>
                        <div className={`text-xs ${statusColors[b.status] || 'text-gray-500'}`}>
                          {statusLabels[b.status] || b.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-gray-400">
              Klant sinds {format(parseISO(selectedCustomer.firstVisit), 'd MMMM yyyy', { locale: nl })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
