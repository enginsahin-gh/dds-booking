import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { Salon, Booking, Service, Staff } from '../../lib/types';

type Period = 'week' | 'month' | 'year';

function fmt(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function fmtShort(cents: number): string {
  if (cents >= 100000) return `€${(cents / 100000).toFixed(1).replace('.', ',')}k`;
  return `€${(cents / 100).toFixed(0)}`;
}

function pctChange(current: number, previous: number): { value: number; label: string; positive: boolean } {
  if (previous === 0 && current === 0) return { value: 0, label: '0%', positive: true };
  if (previous === 0) return { value: 100, label: '+100%', positive: true };
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    value: pct,
    label: `${pct > 0 ? '+' : ''}${pct}%`,
    positive: pct >= 0,
  };
}

function getDateRange(period: Period): { start: Date; end: Date; prevStart: Date; prevEnd: Date; label: string } {
  const now = new Date();
  if (period === 'week') {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    const prevStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const prevEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    return {
      start, end, prevStart, prevEnd,
      label: `${format(start, 'd MMM', { locale: nl })} — ${format(end, 'd MMM yyyy', { locale: nl })}`,
    };
  }
  if (period === 'month') {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const prevStart = startOfMonth(subMonths(now, 1));
    const prevEnd = endOfMonth(subMonths(now, 1));
    return {
      start, end, prevStart, prevEnd,
      label: format(now, 'MMMM yyyy', { locale: nl }),
    };
  }
  // year
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  const prevStart = new Date(now.getFullYear() - 1, 0, 1);
  const prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
  return {
    start, end, prevStart, prevEnd,
    label: `${now.getFullYear()}`,
  };
}

function BarChart({ items, maxValue }: { items: { label: string; value: number; color?: string }[]; maxValue: number }) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-medium text-gray-700 truncate max-w-[60%]">{item.label}</span>
            <span className="text-[13px] font-bold text-gray-900">{fmt(item.value)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${item.color || 'bg-violet-500'}`}
              style={{ width: maxValue > 0 ? `${Math.max((item.value / maxValue) * 100, 2)}%` : '0%' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const [period, setPeriod] = useState<Period>('week');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [prevBookings, setPrevBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => getDateRange(period), [period]);

  useEffect(() => {
    if (!salon) return;
    setLoading(true);
    Promise.all([
      supabase.from('bookings').select('*').eq('salon_id', salon.id)
        .gte('start_at', startOfDay(range.start).toISOString())
        .lte('start_at', endOfDay(range.end).toISOString()),
      supabase.from('bookings').select('*').eq('salon_id', salon.id)
        .gte('start_at', startOfDay(range.prevStart).toISOString())
        .lte('start_at', endOfDay(range.prevEnd).toISOString()),
      supabase.from('services').select('*').eq('salon_id', salon.id),
      supabase.from('staff').select('*').eq('salon_id', salon.id),
    ]).then(([bRes, pbRes, sRes, stRes]) => {
      setBookings(bRes.data || []);
      setPrevBookings(pbRes.data || []);
      setServices(sRes.data || []);
      setStaffList(stRes.data || []);
      setLoading(false);
    });
  }, [salon, range.start.getTime(), range.end.getTime()]);

  // Calculate stats
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const prevConfirmed = prevBookings.filter(b => b.status === 'confirmed');
  const cancelled = bookings.filter(b => b.status === 'cancelled');
  const noShows = bookings.filter(b => b.status === 'no_show');

  const totalRevenue = confirmed.reduce((sum, b) => sum + (b.amount_total_cents || services.find(s => s.id === b.service_id)?.price_cents || 0), 0);
  const prevRevenue = prevConfirmed.reduce((sum, b) => sum + (b.amount_total_cents || services.find(s => s.id === b.service_id)?.price_cents || 0), 0);
  const totalPaid = confirmed.reduce((sum, b) => sum + (b.amount_paid_cents || 0), 0);

  const revenueDelta = pctChange(totalRevenue, prevRevenue);
  const bookingsDelta = pctChange(confirmed.length, prevConfirmed.length);

  // Per staff
  const staffStats = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const b of confirmed) {
      const member = staffList.find(s => s.id === b.staff_id);
      const name = member?.name || 'Onbekend';
      const existing = map.get(b.staff_id) || { name, revenue: 0, count: 0 };
      existing.revenue += b.amount_total_cents || services.find(s => s.id === b.service_id)?.price_cents || 0;
      existing.count++;
      map.set(b.staff_id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [confirmed, staffList, services]);

  // Per service
  const serviceStats = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const b of confirmed) {
      const svc = services.find(s => s.id === b.service_id);
      const name = svc?.name || 'Onbekend';
      const existing = map.get(b.service_id) || { name, revenue: 0, count: 0 };
      existing.revenue += b.amount_total_cents || svc?.price_cents || 0;
      existing.count++;
      map.set(b.service_id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [confirmed, services]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const b of confirmed) {
      const key = b.customer_email.toLowerCase();
      const existing = map.get(key) || { name: b.customer_name, revenue: 0, count: 0 };
      existing.revenue += b.amount_total_cents || services.find(s => s.id === b.service_id)?.price_cents || 0;
      existing.count++;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [confirmed, services]);

  const prevPeriodLabel = period === 'week' ? 'vorige week' : period === 'month' ? 'vorige maand' : 'vorig jaar';

  if (!salon) return null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Statistieken</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{range.label}</p>
        </div>
        <div className="flex rounded-xl bg-gray-100 p-0.5">
          {(['week', 'month', 'year'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-[13px] font-medium rounded-[10px] transition-all ${
                period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === 'week' ? 'Week' : p === 'month' ? 'Maand' : 'Jaar'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <div className="space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card padding="md">
              <div className="text-center">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Omzet</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{fmtShort(totalRevenue)}</p>
                <div className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold ${revenueDelta.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={revenueDelta.positive ? '' : 'rotate-180'}>
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                  {revenueDelta.label}
                  <span className="text-gray-400 font-normal ml-0.5">vs {prevPeriodLabel}</span>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="text-center">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Boekingen</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{confirmed.length}</p>
                <div className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold ${bookingsDelta.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={bookingsDelta.positive ? '' : 'rotate-180'}>
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                  {bookingsDelta.label}
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="text-center">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Online betaald</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtShort(totalPaid)}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {totalRevenue > 0 ? `${Math.round((totalPaid / totalRevenue) * 100)}% van omzet` : '-'}
                </p>
              </div>
            </Card>
            <Card padding="md">
              <div className="text-center">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Annuleringen</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{cancelled.length + noShows.length}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {noShows.length > 0 && <span className="text-red-500 font-medium">{noShows.length} no-show</span>}
                  {noShows.length > 0 && cancelled.length > 0 && ' · '}
                  {cancelled.length > 0 && `${cancelled.length} geannuleerd`}
                  {noShows.length === 0 && cancelled.length === 0 && '-'}
                </p>
              </div>
            </Card>
          </div>

          {/* Revenue breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Per staff */}
            <Card padding="lg">
              <div className="mb-4">
                <h3 className="text-[14px] font-bold text-gray-900">Omzet per medewerker</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">{staffStats.length} medewerkers actief</p>
              </div>
              {staffStats.length > 0 ? (
                <BarChart
                  items={staffStats.map(s => ({ label: `${s.name} (${s.count})`, value: s.revenue }))}
                  maxValue={Math.max(...staffStats.map(s => s.revenue))}
                />
              ) : (
                <p className="text-[13px] text-gray-400 py-6 text-center">Geen data voor deze periode</p>
              )}
            </Card>

            {/* Per service */}
            <Card padding="lg">
              <div className="mb-4">
                <h3 className="text-[14px] font-bold text-gray-900">Omzet per dienst</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Top {Math.min(serviceStats.length, 8)} diensten</p>
              </div>
              {serviceStats.length > 0 ? (
                <BarChart
                  items={serviceStats.slice(0, 8).map(s => ({ label: `${s.name} (${s.count}x)`, value: s.revenue, color: 'bg-indigo-500' }))}
                  maxValue={Math.max(...serviceStats.map(s => s.revenue))}
                />
              ) : (
                <p className="text-[13px] text-gray-400 py-6 text-center">Geen data voor deze periode</p>
              )}
            </Card>
          </div>

          {/* Top customers */}
          {topCustomers.length > 0 && (
            <Card padding="lg">
              <div className="mb-4">
                <h3 className="text-[14px] font-bold text-gray-900">Top klanten</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Meeste omzet deze {period === 'week' ? 'week' : period === 'month' ? 'maand' : 'jaar'}</p>
              </div>
              <div className="space-y-2">
                {topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-gray-900 truncate">{c.name}</div>
                        <div className="text-[11px] text-gray-400">{c.count} boekingen</div>
                      </div>
                    </div>
                    <span className="text-[14px] font-bold text-gray-900 flex-shrink-0">{fmt(c.revenue)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Average per booking */}
          {confirmed.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Card padding="md">
                <div className="text-center">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Gem. per boeking</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{fmt(Math.round(totalRevenue / confirmed.length))}</p>
                </div>
              </Card>
              <Card padding="md">
                <div className="text-center">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Gem. per dag</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {fmt(Math.round(totalRevenue / (period === 'week' ? 7 : period === 'month' ? 30 : 365)))}
                  </p>
                </div>
              </Card>
              <Card padding="md">
                <div className="text-center">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">No-show rate</p>
                  <p className={`text-xl font-bold mt-1 ${noShows.length > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {bookings.length > 0 ? `${Math.round((noShows.length / bookings.length) * 100)}%` : '0%'}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
