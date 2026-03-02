import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../ui/Spinner';
import type React from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, salonUser, loading } = useAuth();

  // Still initializing auth
  if (loading) return <Spinner className="min-h-screen" />;

  // No user → login
  if (!user) return <Navigate to="/admin/login" replace />;
  
  // User exists but salonUser still loading (undefined = not yet fetched)
  if (salonUser === undefined) return <Spinner className="min-h-screen" />;

  // User exists, salonUser confirmed null → no access
  if (salonUser === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Geen toegang</h2>
          <p className="text-sm text-gray-500 mb-4">Je account is niet gekoppeld aan een salon. Neem contact op met de eigenaar.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Route guard for owner-only pages */
export function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { isOwner, loading } = useAuth();

  if (loading) return <Spinner className="min-h-screen" />;
  if (!isOwner) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}
