import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { UserRole } from '../../hooks/useAuth';

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

function useWaitlistCount(salonId: string | undefined) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!salonId) return;
    const checkWaitlist = async () => {
      const { count: c } = await supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .eq('status', 'waiting');
      setCount(c || 0);
    };
    checkWaitlist();
    const interval = setInterval(checkWaitlist, 120000); // Every 2 min
    return () => clearInterval(interval);
  }, [salonId]);
  return count;
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: 'bookings' | 'waitlist';
  ownerOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', end: true },
  { to: '/admin/bookings', label: 'Boekingen', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', badge: 'bookings' },
  { to: '/admin/communicatie', label: 'Communicatie', icon: 'M8 10h8m-8 4h6m-8-10h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z' },
  { to: '/admin/customers', label: 'Klanten', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { to: '/admin/waitlist', label: 'Wachtlijst', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', badge: 'waitlist' },
  { to: '/admin/services', label: 'Diensten', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z', ownerOnly: true },
  { to: '/admin/staff', label: 'Team', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { to: '/admin/stats', label: 'Statistieken', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', ownerOnly: true },
  { to: '/admin/settings', label: 'Instellingen', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', ownerOnly: true },
];

function NavIcon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export function Sidebar({ salonId, role }: { salonId?: string; role?: UserRole | null }) {
  const bookingsCount = useNewBookingsCount(salonId);
  const waitlistCount = useWaitlistCount(salonId);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('admin_sidebar_collapsed') : null;
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin_sidebar_collapsed', String(next));
    }
  };

  const getBadgeCount = (badge?: 'bookings' | 'waitlist') => {
    if (badge === 'bookings') return bookingsCount;
    if (badge === 'waitlist') return waitlistCount;
    return 0;
  };

  const isOwner = role === 'owner';
  const visibleItems = navItems.filter(item => !item.ownerOnly || isOwner);
  const moreItemIndices = visibleItems.map((_, i) => i).filter(i => i >= 4);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex lg:flex-col ${collapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'} bg-white border-r border-gray-200/80 transition-all duration-200 relative overflow-visible`}>
        {/* Logo */}
        <div className={`h-14 flex items-center border-b border-gray-100 ${collapsed ? 'px-3 justify-center' : 'px-5'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-white border border-gray-200/70 flex items-center justify-center shadow-[0_2px_8px_rgba(59,78,108,0.25)]">
              <img src="/logo-mark-blue.png" alt="Bellure" className="w-5 h-5 object-contain" />
            </div>
            {!collapsed && <span className="text-[15px] font-bold text-gray-900 tracking-tight">Bellure</span>}
          </div>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-3 space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-[10px] text-[13px] font-medium transition-all duration-150 ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2'
                } ${
                  isActive
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span className="relative">
                <NavIcon d={item.icon} className="w-[18px] h-[18px]" />
                {collapsed && item.badge && getBadgeCount(item.badge) > 0 && (
                  <span className="absolute -top-2 -right-2 bg-violet-600 text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                    {getBadgeCount(item.badge) > 99 ? '99+' : getBadgeCount(item.badge)}
                  </span>
                )}
              </span>
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.badge && getBadgeCount(item.badge) > 0 && (
                <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
                  {getBadgeCount(item.badge) > 99 ? '99+' : getBadgeCount(item.badge)}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="px-5 py-4 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 font-medium">Bellure v1.0</p>
          </div>
        )}

        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Menu uitklappen' : 'Menu inklappen'}
          className="absolute bottom-5 right-0 translate-x-1/2 w-10 h-10 rounded-full bg-white border border-gray-200/80 shadow-[0_10px_24px_rgba(59,78,108,0.2)] flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors z-20"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
          </svg>
        </button>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-200/80 safe-area-bottom">
        {/* "Meer" popover */}
        {moreOpen && moreItemIndices.length > 0 && (
          <>
            <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-full right-2 mb-2 z-50 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 py-1.5 w-48">
              {moreItemIndices.map(idx => {
                const item = visibleItems[idx];
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors ${
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
          {visibleItems.slice(0, 4).map((item) => (
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
                {item.badge && getBadgeCount(item.badge) > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-violet-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                    {getBadgeCount(item.badge) > 9 ? '9+' : getBadgeCount(item.badge)}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}

          {/* "Meer" button */}
          {moreItemIndices.length > 0 && (
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
          )}
        </div>
      </nav>
    </>
  );
}
