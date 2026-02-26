import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { useSalon } from '../../hooks/useSalon';

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const { salon } = useSalon(undefined, user?.id);

  return (
    <div className="flex h-[100dvh] bg-gray-50">
      <Sidebar salonId={salon?.id} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - desktop only (mobile has bottom nav) */}
        <header className="hidden lg:flex h-14 border-b border-gray-200 bg-white items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {salon && <h2 className="text-sm font-semibold text-gray-700">{salon.name}</h2>}
          </div>
          <button
            onClick={signOut}
            className="text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
          >
            Uitloggen
          </button>
        </header>

        {/* Mobile header - compact */}
        <header className="lg:hidden flex h-12 border-b border-gray-100 bg-white items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center text-[10px] font-bold text-white">D</div>
            {salon && <h2 className="text-sm font-semibold text-gray-900 truncate">{salon.name}</h2>}
          </div>
          <button
            onClick={signOut}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium"
          >
            Uit
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="p-4 lg:p-6 max-w-6xl">
            <Outlet context={{ salon, user }} />
          </div>
        </main>
      </div>
    </div>
  );
}
