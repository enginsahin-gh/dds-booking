import { useMemo, useEffect, useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { format, startOfDay, endOfDay, subDays, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';
import { useBookings } from '../../hooks/useBookings';
import { useServices } from '../../hooks/useServices';
import { useStaff } from '../../hooks/useStaff';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/ui/Card';
import { Card } from '../../components/ui/Card';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import type { Salon, Booking } from '../../lib/types';

/** Tiny sparkline component — 7-day revenue mini-graph */
function Sparkline({ data, color = '#3B4E6C', height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const width = 160;
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * chartW;
    const y = padding + chartH - (v / max) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const areaPath = `M ${padding},${padding + chartH} ` +
    data.map((v, i) => {
      const x = padding + (i / (data.length - 1)) * chartW;
      const y = padding + chartH - (v / max) * chartH;
      return `L ${x},${y}`;
    }).join(' ') +
    ` L ${padding + chartW},${padding + chartH} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Status badge for bookings */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Bevestigd' },
    completed: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Voltooid' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-700', label: 'Geannuleerd' },
    pending_payment: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Wacht' },
    no_show: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'No-show' },
  };
  const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

export function DashboardPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { canSeeRevenue, isOwner } = useAuth();
  const navigate = useNavigate();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [weekRevenue, setWeekRevenue] = useState<number[]>([]);

  // Check if onboarding is needed (owner only)
  useEffect(() => {
    if (!salon?.id || !isOwner) { setOnboardingChecked(true); return; }
    async function check() {
      const [{ count: svcCount }, { count: staffCount }] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('salon_id', salon!.id),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('salon_id', salon!.id),
      ]);
      if ((svcCount ?? 0) === 0 || (staffCount ?? 0) === 0) {
        navigate('/admin/onboarding', { replace: true });
        return;
      }
      const { data: staffRows } = await supabase.from('staff').select('id').eq('salon_id', salon!.id).limit(1);
      if (staffRows?.length) {
        const { count: sc } = await supabase.from('staff_schedules').select('id', { count: 'exact', head: true }).eq('staff_id', staffRows[0].id);
        if ((sc ?? 0) === 0) {
          navigate('/admin/onboarding', { replace: true });
          return;
        }
      }
      setOnboardingChecked(true);
    }
    check();
  }, [salon?.id, isOwner, navigate]);

  // Fetch recent bookings (last 5) + 7-day revenue sparkline
  useEffect(() => {
    if (!salon?.id) return;
    const now = new Date();
    // Last 5 bookings
    supabase
      .from('bookings')
      .select('*')
      .eq('salon_id', salon.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentBookings(data || []));

    // 7-day revenue
    const weekStart = startOfDay(subDays(now, 6));
    supabase
      .from('bookings')
      .select('start_at, amount_total_cents, status')
      .eq('salon_id', salon.id)
      .gte('start_at', weekStart.toISOString())
      .lte('start_at', endOfDay(now).toISOString())
      .in('status', ['confirmed', 'completed'])
      .then(({ data }) => {
        // Group by day
        const dayMap = new Map<string, number>();
        for (let i = 6; i >= 0; i--) {
          dayMap.set(format(subDays(now, i), 'yyyy-MM-dd'), 0);
        }
        for (const b of (data || [])) {
          const key = format(parseISO(b.start_at), 'yyyy-MM-dd');
          if (dayMap.has(key)) {
            dayMap.set(key, (dayMap.get(key) || 0) + (b.amount_total_cents || 0));
          }
        }
        setWeekRevenue(Array.from(dayMap.values()));
      });
  }, [salon?.id]);

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
    const total = b.amount_total_cents || services.find(s => s.id === b.service_id)?.price_cents || 0;
    return sum + total;
  }, 0);
  const paidOnline = confirmed.reduce((sum, b) => sum + (b.amount_paid_cents || 0), 0);

  if (loading || !onboardingChecked) return <DashboardSkeleton />;

  const greeting = today.getHours() < 12 ? 'Goedemorgen' : today.getHours() < 18 ? 'Goedemiddag' : 'Goedenavond';

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">{greeting}</h1>
        <p className="text-[13px] text-gray-500 mt-0.5 font-medium">
          {format(today, 'EEEE d MMMM yyyy', { locale: nl })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={<svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          value={confirmed.length}
          label="Afspraken vandaag"
          color="violet"
        />
        {canSeeRevenue && (
          <StatCard
            icon={<svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            value={`€${(revenue / 100).toFixed(0)}`}
            label="Verwachte omzet"
          />
        )}
        {canSeeRevenue && (
          <StatCard
            icon={<svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
            value={`€${(paidOnline / 100).toFixed(0)}`}
            label="Online betaald"
            color="green"
          />
        )}
        <StatCard
          icon={<svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          value={pending.length}
          label="Wacht op betaling"
          color="amber"
        />
      </div>

      {/* Sparkline (7-day revenue) */}
      {canSeeRevenue && weekRevenue.length > 0 && weekRevenue.some(v => v > 0) && (
        <Card padding="sm" className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Omzet afgelopen 7 dagen</p>
              <p className="text-[16px] font-bold text-gray-900 mt-0.5">
                €{(weekRevenue.reduce((a, b) => a + b, 0) / 100).toFixed(0)}
              </p>
            </div>
            <Sparkline data={weekRevenue} />
          </div>
        </Card>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
        <Link
          to="/admin/bookings"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-[13px] font-semibold rounded-xl hover:bg-violet-700 hover:shadow-[0_4px_12px_rgba(124,58,237,0.25)] transition-all duration-200 active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Agenda openen
        </Link>
        <Link
          to="/admin/bookings?new=1"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-[13px] font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nieuwe boeking
        </Link>
        <Link
          to="/admin/services"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-[13px] font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 active:scale-[0.98]"
        >
          Dienst toevoegen
        </Link>
        <Link
          to="/admin/staff"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-[13px] font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 active:scale-[0.98]"
        >
          Medewerker toevoegen
        </Link>
        <Link
          to="/admin/customers"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-[13px] font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 active:scale-[0.98]"
        >
          Klanten bekijken
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Today's upcoming appointments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-gray-900">Eerstvolgende afspraken</h2>
            <Link to="/admin/bookings" className="text-[12px] text-violet-600 font-semibold hover:text-violet-700 transition-colors">
              Alles bekijken
            </Link>
          </div>
          {confirmed.length > 0 ? (
            <div className="space-y-2">
              {confirmed.slice(0, 5).map(b => {
                const service = services.find(s => s.id === b.service_id);
                const member = staff.find(s => s.id === b.staff_id);
                const priceCents = b.amount_total_cents || service?.price_cents || 0;

                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3.5 flex items-center gap-3 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-200 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
                      <p className="text-[14px] font-bold text-violet-700">{format(new Date(b.start_at), 'HH:mm')}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 truncate">{b.customer_name}</p>
                      <p className="text-[12px] text-gray-500 truncate">{service?.name} · {member?.name}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[14px] font-semibold text-gray-900">€{(priceCents / 100).toFixed(2).replace('.', ',')}</p>
                      {b.amount_paid_cents > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                          Betaald
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-gray-600">Geen afspraken vandaag</p>
              <p className="text-[13px] text-gray-400 mt-1">Geniet van je vrije dag!</p>
            </Card>
          )}
        </div>

        {/* Recent bookings (all statuses) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-gray-900">Recente boekingen</h2>
            <Link to="/admin/bookings" className="text-[12px] text-violet-600 font-semibold hover:text-violet-700 transition-colors">
              Alle boekingen
            </Link>
          </div>
          {recentBookings.length > 0 ? (
            <div className="space-y-2">
              {recentBookings.map(b => {
                const service = services.find(s => s.id === b.service_id);
                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3.5 flex items-center gap-3 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-200 transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{b.customer_name}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="text-[12px] text-gray-500 truncate">
                        {service?.name} · {format(parseISO(b.start_at), 'd MMM HH:mm', { locale: nl })}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <p className="text-[13px] font-semibold text-gray-900">
                        €{((b.amount_total_cents || service?.price_cents || 0) / 100).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-8">
              <p className="text-[13px] text-gray-400">Nog geen boekingen</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
