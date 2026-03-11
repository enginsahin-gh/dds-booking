import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../ui/Spinner';
import { API_BASE } from '../../lib/config';

export function PlatformRoute({ children }: { children: React.ReactNode }) {
  const { user, session, loading, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!session) return;
    const check = async () => {
      setChecking(true);
      try {
        const res = await fetch(`${API_BASE}/api/platform/me`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        setAllowed(res.ok);
      } catch {
        setAllowed(false);
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [session]);

  if (loading) return <Spinner className="min-h-screen" />;
  if (!user) return <Navigate to="/admin/login" replace state={{ redirectTo: '/platform' }} />;
  if (checking) return <Spinner className="min-h-screen" />;

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Geen toegang</h2>
          <p className="text-sm text-gray-500 mb-4">Je account is niet gemachtigd voor het platform‑beheer.</p>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl bg-gray-900 text-white shadow-sm hover:bg-black transition-colors"
          >
            Uitloggen
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
