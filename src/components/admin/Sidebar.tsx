import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

function useNewBookingsCount(salonId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!salonId) return;

    // Count today's confirmed bookings as "new" indicator
    const checkNew = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: c } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .gte('created_at', today.toISOString())
        .in('status', ['confirmed', 'pending_payment']);
      setCount(c || 0);
    };

    checkNew();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('booking-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `salon_id=eq.${salonId}`,
      }, () => {
        checkNew();
      })
      .subscribe();

    // Poll every 60s as fallback
    const interval = setInterval(checkNew, 60000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [salonId]);

  return count;
}

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/bookings', label: 'Boekingen', icon: '📅', badge: true },
  { to: '/admin/customers', label: 'Klanten', icon: '👤' },
  { to: '/admin/services', label: 'Diensten', icon: '✂️' },
  { to: '/admin/staff', label: 'Medewerkers', icon: '👥' },
  { to: '/admin/payments', label: 'Betalingen', icon: '💳' },
  { to: '/admin/settings', label: 'Instellingen', icon: '⚙️' },
];

function NavItems({ onClick, badgeCount }: { onClick?: () => void; badgeCount: number }) {
  return (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-violet-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          <span>{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.badge && badgeCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </NavLink>
      ))}
    </>
  );
}

export function Sidebar({ salonId }: { salonId?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const badgeCount = useNewBookingsCount(salonId);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-gray-900 text-white shadow-lg"
        aria-label="Menu openen"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-gray-900 text-white flex flex-col">
            <div className="p-6 flex items-center justify-between">
              <h1 className="text-lg font-bold">De Digitale Stylist</h1>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-3 space-y-1">
              <NavItems onClick={() => setMobileOpen(false)} badgeCount={badgeCount} />
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h1 className="text-lg font-bold">De Digitale Stylist</h1>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          <NavItems badgeCount={badgeCount} />
        </nav>
      </aside>
    </>
  );
}
