import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

function useNewBookingsCount(salonId: string | undefined) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!salonId) return;
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
    const channel = supabase
      .channel('booking-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings', filter: `salon_id=eq.${salonId}` }, () => checkNew())
      .subscribe();
    const interval = setInterval(checkNew, 60000);
    return () => { channel.unsubscribe(); clearInterval(interval); };
  }, [salonId]);
  return count;
}

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', end: true },
  { to: '/admin/bookings', label: 'Boekingen', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', badge: true },
  { to: '/admin/customers', label: 'Klanten', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { to: '/admin/services', label: 'Diensten', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
  { to: '/admin/staff', label: 'Team', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { to: '/admin/payments', label: 'Betalingen', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { to: '/admin/settings', label: 'Instellingen', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

// Bottom nav: 4 main + "meer" for the rest
const bottomPrimary = [0, 1, 4, 2]; // dashboard, bookings, team, customers

function NavIcon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function DesktopNavItems({ badgeCount }: { badgeCount: number }) {
  return (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <NavIcon d={item.icon} />
          <span className="flex-1">{item.label}</span>
          {item.badge && badgeCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </NavLink>
      ))}
    </>
  );
}

export function Sidebar({ salonId }: { salonId?: string }) {
  const badgeCount = useNewBookingsCount(salonId);
  const [moreOpen, setMoreOpen] = useState(false);

  // Items in "meer" menu: diensten, betalingen, instellingen
  const moreItems = [3, 5, 6]; // services, payments, settings

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-gradient-to-b from-gray-900 to-gray-950 text-white">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-sm font-bold">D</div>
            <div>
              <h1 className="text-sm font-bold leading-tight">De Digitale Stylist</h1>
              <p className="text-[10px] text-gray-500 font-medium">Admin Panel</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <DesktopNavItems badgeCount={badgeCount} />
        </nav>
        <div className="px-4 py-4 border-t border-white/5">
          <p className="text-[10px] text-gray-600 text-center">De Digitale Stylist v1.0</p>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
        {/* "Meer" popover */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-full right-2 mb-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 w-48 animate-in fade-in">
              {moreItems.map(idx => {
                const item = navItems[idx];
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                        isActive ? 'text-violet-600 bg-violet-50' : 'text-gray-700 hover:bg-gray-50'
                      }`
                    }
                  >
                    <NavIcon d={item.icon} className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </>
        )}

        <div className="flex items-stretch">
          {bottomPrimary.map(idx => {
            const item = navItems[idx];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center py-2 pt-2.5 gap-0.5 relative transition-colors ${
                    isActive ? 'text-violet-600' : 'text-gray-400'
                  }`
                }
              >
                <div className="relative">
                  <NavIcon d={item.icon} className="w-5 h-5" />
                  {item.badge && badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}

          {/* "Meer" button */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center py-2 pt-2.5 gap-0.5 transition-colors ${
              moreOpen ? 'text-violet-600' : 'text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
            <span className="text-[10px] font-medium">Meer</span>
          </button>
        </div>
      </nav>
    </>
  );
}
