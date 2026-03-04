import { useMemo, useEffect, useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { format, startOfDay, endOfDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';
import { useBookings } from '../../hooks/useBookings';
import { useServices } from '../../hooks/useServices';
import { useStaff } from '../../hooks/useStaff';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/ui/Card';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import type { Salon } from '../../lib/types';

export function DashboardPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { canSeeRevenue, isOwner } = useAuth();
  const navigate = useNavigate();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

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
      // Check schedules
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
    // Use amount_total_cents (server-calculated, includes multi-service) with fallback to service lookup
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
          to="/admin/customers"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-[13px] font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 active:scale-[0.98]"
        >
          Klanten bekijken
        </Link>
      </div>

      {/* Upcoming appointments */}
      {confirmed.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-gray-900">Eerstvolgende afspraken</h2>
            <Link to="/admin/bookings" className="text-[12px] text-violet-600 font-semibold hover:text-violet-700 transition-colors">
              Alles bekijken
            </Link>
          </div>
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
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-gray-600">Geen afspraken vandaag</p>
          <p className="text-[13px] text-gray-400 mt-1">Geniet van je vrije dag!</p>
          <Link
            to="/admin/bookings"
            className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-semibold text-violet-600 hover:text-violet-700 transition-colors"
          >
            Bekijk de agenda
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        </div>
      )}
    </div>
  );
}
