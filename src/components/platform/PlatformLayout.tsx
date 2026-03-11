import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function PlatformLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200/70 flex items-center justify-center">
              <img src="/logo-mark-blue.png" alt="Bellure" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-gray-900">Bellure Platform</div>
              <div className="text-[11px] text-gray-500">Interne beheeromgeving</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-gray-500">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-gray-900 text-white hover:bg-black transition-colors"
            >
              Uitloggen
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
