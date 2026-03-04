import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { startOfDay, endOfDay, subDays, subMonths, format, parseISO, differenceInDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { LineChart } from '../../components/ui/LineChart';
import { BarChart } from '../../components/ui/BarChart';
import { HeatMap } from '../../components/ui/HeatMap';
import type { Salon, Booking, Service, Staff } from '../../lib/types';

type Period = '7d' | '30d' | '90d' | '12m';

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

function getDateRange(period: Period): { start: Date; end: Date; prevStart: Date; prevEnd: Date; days: number } {
  const now = new Date();
  const end = endOfDay(now);

  if (period === '7d') {
    const start = startOfDay(subDays(now, 6));
    const prevEnd = endOfDay(subDays(start, 1));
    const prevStart = startOfDay(subDays(prevEnd, 6));
    return { start, end, prevStart, prevEnd, days: 7 };
  }
  if (period === '30d') {
    const start = startOfDay(subDays(now, 29));
    const prevEnd = endOfDay(subDays(start, 1));
    const prevStart = startOfDay(subDays(prevEnd, 29));
    return { start, end, prevStart, prevEnd, days: 30 };
  }
  if (period === '90d') {
    const start = startOfDay(subDays(now, 89));
    const prevEnd = endOfDay(subDays(start, 1));
    const prevStart = startOfDay(subDays(prevEnd, 89));
    return { start, end, prevStart, prevEnd, days: 90 };
  }
  // 12m
  const start = startOfDay(subMonths(now, 12));
  const prevEnd = endOfDay(subDays(start, 1));
  const prevStart = startOfDay(subMonths(prevEnd, 12));
  return { start, end, prevStart, prevEnd, days: 365 };
}

function getBookingRevenue(b: Booking, services: Service[]): number {
  return b.amount_total_cents || services.find(s => s.id === b.service_id)?.price_cents || 0;
}

export function StatsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const [period, setPeriod] = useState<Period>('30d');
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
        .gte('start_at', range.start.toISOString())
        .lte('start_at', range.end.toISOString()),
      supabase.from('bookings').select('*').eq('salon_id', salon.id)
        .gte('start_at', range.prevStart.toISOString())
        .lte('start_at', range.prevEnd.toISOString()),
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

  // Confirmed = confirmed + completed
  const confirmed = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const prevConfirmed = prevBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const cancelled = bookings.filter(b => b.status === 'cancelled');
  const noShows = bookings.filter(b => b.status === 'no_show');

  const totalRevenue = confirmed.reduce((sum, b) => sum + getBookingRevenue(b, services), 0);
  const prevRevenue = prevConfirmed.reduce((sum, b) => sum + getBookingRevenue(b, services), 0);
  const totalPaid = confirmed.reduce((sum, b) => sum + (b.amount_paid_cents || 0), 0);

  // Calculate elapsed days for avg/day (not fixed period length)
  const elapsedDays = useMemo(() => {
    const now = new Date();
    return Math.max(1, differenceInDays(now, range.start) + 1);
  }, [range.start]);

  const revenueDelta = pctChange(totalRevenue, prevRevenue);
  const bookingsDelta = pctChange(confirmed.length, prevConfirmed.length);

  // Revenue over time (line chart data)
  const revenueTimeline = useMemo(() => {
    if (period === '12m') {
      // Group by month
      const months = new Map<string, number>();
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        months.set(format(d, 'yyyy-MM'), 0);
      }
      for (const b of confirmed) {
        const key = format(parseISO(b.start_at), 'yyyy-MM');
        if (months.has(key)) {
          months.set(key, (months.get(key) || 0) + getBookingRevenue(b, services));
        }
      }
      return Array.from(months.entries()).map(([key, value]) => ({
        label: format(parseISO(key + '-01'), 'MMM', { locale: nl }),
        value,
      }));
    }
    // Group by day
    const days = new Map<string, number>();
    const numDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    for (let i = numDays - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      days.set(format(d, 'yyyy-MM-dd'), 0);
    }
    for (const b of confirmed) {
      const key = format(parseISO(b.start_at), 'yyyy-MM-dd');
      if (days.has(key)) {
        days.set(key, (days.get(key) || 0) + getBookingRevenue(b, services));
      }
    }
    return Array.from(days.entries()).map(([key, value]) => ({
      label: format(parseISO(key), period === '7d' ? 'EEE' : 'd MMM', { locale: nl }),
      value,
    }));
  }, [confirmed, services, period]);

  // Bookings per day (bar chart data)
  const bookingsPerDay = useMemo(() => {
    const numDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    const days = new Map<string, number>();
    for (let i = numDays - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      days.set(format(d, 'yyyy-MM-dd'), 0);
    }
    for (const b of confirmed) {
      const key = format(parseISO(b.start_at), 'yyyy-MM-dd');
      if (days.has(key)) {
        days.set(key, (days.get(key) || 0) + 1);
      }
    }
    return Array.from(days.entries()).map(([key, value]) => ({
      label: format(parseISO(key), numDays <= 7 ? 'EEE' : 'd MMM', { locale: nl }),
      value,
    }));
  }, [confirmed, period]);

  // Popular services (top 5 by booking count)
  const popularServices = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const b of confirmed) {
      const svc = services.find(s => s.id === b.service_id);
      const name = svc?.name || 'Onbekend';
      const existing = map.get(b.service_id) || { name, count: 0 };
      existing.count++;
      map.set(b.service_id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [confirmed, services]);

  const maxServiceCount = Math.max(...popularServices.map(s => s.count), 1);

  // Heatmap data: 7 days x 24 hours
  const heatmapData = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const b of confirmed) {
      const date = parseISO(b.start_at);
      // JS getDay: 0=Sunday, but we want 0=Monday
      const jsDay = date.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      const hour = date.getHours();
      matrix[dayIndex][hour]++;
    }
    return matrix;
  }, [confirmed]);

  // Per staff stats
  const staffStats = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const b of confirmed) {
      const member = staffList.find(s => s.id === b.staff_id);
      const name = member?.name || 'Onbekend';
      const existing = map.get(b.staff_id) || { name, revenue: 0, count: 0 };
      existing.revenue += getBookingRevenue(b, services);
      existing.count++;
      map.set(b.staff_id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [confirmed, staffList, services]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const b of confirmed) {
      const key = b.customer_email.toLowerCase();
      const existing = map.get(key) || { name: b.customer_name, revenue: 0, count: 0 };
      existing.revenue += getBookingRevenue(b, services);
      existing.count++;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [confirmed, services]);

  const periodLabels: Record<Period, string> = {
    '7d': 'Afgelopen 7 dagen',
    '30d': 'Afgelopen 30 dagen',
    '90d': 'Afgelopen 90 dagen',
    '12m': 'Afgelopen 12 maanden',
  };

  if (!salon) return null;

  return (
    <div>
      {/* Header + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Statistieken</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{periodLabels[period]}</p>
        </div>
        <div className="flex rounded-xl bg-gray-100 p-0.5">
          {(['7d', '30d', '90d', '12m'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 text-[12px] sm:text-[13px] font-medium rounded-[10px] transition-all ${
                period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <div className="space-y-5">
          {/* Summary StatCards */}
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
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Gem. per dag</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(Math.round(totalRevenue / elapsedDays))}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">{elapsedDays} dagen</p>
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

          {/* Charts: Revenue (line) + Bookings (bar) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card padding="lg">
              <div className="mb-4">
                <h3 className="text-[14px] font-bold text-gray-900">Omzet verloop</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  {period === '12m' ? 'Per maand' : 'Per dag'} — totaal {fmt(totalRevenue)}
                </p>
              </div>
              <LineChart
                data={revenueTimeline}
                color="#8B5CF6"
                height={220}
                formatValue={(v) => fmt(v)}
              />
            </Card>
            <Card padding="lg">
              <div className="mb-4">
                <h3 className="text-[14px] font-bold text-gray-900">Boekingen per dag</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  Totaal {confirmed.length} boekingen
                </p>
              </div>
              <BarChart
                data={bookingsPerDay}
                color="#6366F1"
                height={220}
                formatValue={(v) => `${v} boekingen`}
              />
            </Card>
          </div>

          {/* Popular services + Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Popular services */}
            <Card padding="lg">
              <div className="mb-4">
                <h3 className="text-[14px] font-bold text-gray-900">Populaire diensten</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Top {popularServices.length} op basis van boekingen</p>
              </div>
              {popularServices.length > 0 ? (
                <div className="space-y-3">
                  {popularServices.map((svc, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-bold text-violet-600 w-5 flex-shrink-0">{i + 1}</span>
                          <span className="text-[13px] font-medium text-gray-700 truncate">{svc.name}</span>
                        </div>
                        <span className="text-[13px] font-bold text-gray-900 flex-shrink-0">{svc.count}x</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{ width: `${Math.max((svc.count / maxServiceCount) * 100, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-gray-400 py-6 text-center">Geen data voor deze periode</p>
              )}
            </Card>

            {/* Heatmap */}
            <Card padding="lg">
              <div className="mb-4">
                <h3 className="text-[14px] font-bold text-gray-900">Drukste momenten</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Boekingen per dag en tijdstip</p>
              </div>
              <HeatMap data={heatmapData} />
            </Card>
          </div>

          {/* Revenue breakdown: staff + top customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Per staff */}
            <Card padding="lg">
              <div className="mb-4">
                <h3 className="text-[14px] font-bold text-gray-900">Omzet per medewerker</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">{staffStats.length} medewerkers actief</p>
              </div>
              {staffStats.length > 0 ? (
                <div className="space-y-2.5">
                  {staffStats.map((s, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-medium text-gray-700 truncate max-w-[60%]">{s.name} ({s.count})</span>
                        <span className="text-[13px] font-bold text-gray-900">{fmt(s.revenue)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{ width: `${Math.max((s.revenue / Math.max(...staffStats.map(x => x.revenue), 1)) * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-gray-400 py-6 text-center">Geen data voor deze periode</p>
              )}
            </Card>

            {/* Top customers */}
            {topCustomers.length > 0 && (
              <Card padding="lg">
                <div className="mb-4">
                  <h3 className="text-[14px] font-bold text-gray-900">Top klanten</h3>
                  <p className="text-[12px] text-gray-400 mt-0.5">Meeste omzet</p>
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
          </div>

          {/* Average stats row */}
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
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Online betaald</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">{fmtShort(totalPaid)}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {totalRevenue > 0 ? `${Math.round((totalPaid / totalRevenue) * 100)}% van omzet` : '-'}
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
