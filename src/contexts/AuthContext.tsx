import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'staff';

export type PermissionScope = 'all' | 'specific' | 'self';

export interface SalonUser {
  id: string;
  salon_id: string;
  user_id: string;
  staff_id: string | null;
  role: UserRole;
  display_name: string | null;
  can_see_revenue: boolean;
  read_scope: PermissionScope;
  edit_scope: PermissionScope;
  readable_staff_ids: string[];
  editable_staff_ids: string[];
}

interface AuthState {
  user: User | null;
  session: Session | null;
  salonUser: SalonUser | null | undefined;
  loading: boolean;
  role: UserRole | null;
  salonId: string | null;
  staffId: string | null;
  isOwner: boolean;
  canSeeRevenue: boolean;
  readScope: PermissionScope;
  editScope: PermissionScope;
  /** Returns staff IDs this user can read. null = all (no filter needed). */
  getReadableStaffIds: () => string[] | null;
  /** Returns staff IDs this user can edit. null = all (no filter needed). */
  getEditableStaffIds: () => string[] | null;
  /** Check if user can read data for a specific staff ID */
  canReadStaff: (staffId: string) => boolean;
  /** Check if user can edit data for a specific staff ID */
  canEditStaff: (staffId: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchSalonUserData(userId: string): Promise<SalonUser | null> {
  try {
    const { data, error } = await supabase
      .from('salon_users')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (error) return null;
    return data as SalonUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // undefined = not loaded yet, null = confirmed no record
  const [salonUser, setSalonUser] = useState<SalonUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Single init flow: get session → fetch salon user → done
    async function init() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error || !session?.user) {
          setSession(null);
          setUser(null);
          setSalonUser(null);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session.user);

        const su = await fetchSalonUserData(session.user.id);
        if (!mounted) return;
        setSalonUser(su);
      } catch {
        // Catch-all: ensure we never hang
      } finally {
        if (mounted) {
          setLoading(false);
          initialized.current = true;
        }
      }
    }

    init();

    // Listen for subsequent auth changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (!session?.user) {
        setSalonUser(null);
        if (!initialized.current) setLoading(false);
        return;
      }

      // Re-fetch salon user on new sign-in (fire-and-forget, non-blocking)
      if (_event === 'SIGNED_IN') {
        setSalonUser(undefined); // prevent "geen toegang" flash while loading
        fetchSalonUserData(session.user.id).then((su) => {
          if (mounted) setSalonUser(su);
        });
      }
    });

    // Safety timeout: if init takes more than 6s, force stop loading
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
      }
    }, 6000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    setSalonUser(null);
    await supabase.auth.signOut();
  }, []);

  const role = salonUser?.role ?? null;
  const salonId = salonUser?.salon_id ?? null;
  const staffId = salonUser?.staff_id ?? null;
  const isOwner = role === 'owner';
  const canSeeRevenue = salonUser?.can_see_revenue ?? false;
  const readScope: PermissionScope = isOwner ? 'all' : (salonUser?.read_scope ?? 'self');
  const editScope: PermissionScope = isOwner ? 'all' : (salonUser?.edit_scope ?? 'self');

  const getReadableStaffIds = useCallback((): string[] | null => {
    if (isOwner || readScope === 'all') return null; // null = no filter
    if (readScope === 'specific') {
      const ids = [...(salonUser?.readable_staff_ids || [])];
      if (staffId && !ids.includes(staffId)) ids.push(staffId); // always include self
      return ids;
    }
    // 'self' — only own staff
    return staffId ? [staffId] : [];
  }, [isOwner, readScope, salonUser?.readable_staff_ids, staffId]);

  const getEditableStaffIds = useCallback((): string[] | null => {
    if (isOwner || editScope === 'all') return null;
    if (editScope === 'specific') {
      const ids = [...(salonUser?.editable_staff_ids || [])];
      if (staffId && !ids.includes(staffId)) ids.push(staffId);
      return ids;
    }
    return staffId ? [staffId] : [];
  }, [isOwner, editScope, salonUser?.editable_staff_ids, staffId]);

  const canReadStaff = useCallback((targetStaffId: string): boolean => {
    const ids = getReadableStaffIds();
    return ids === null || ids.includes(targetStaffId);
  }, [getReadableStaffIds]);

  const canEditStaff = useCallback((targetStaffId: string): boolean => {
    const ids = getEditableStaffIds();
    return ids === null || ids.includes(targetStaffId);
  }, [getEditableStaffIds]);

  return (
    <AuthContext.Provider value={{
      user, session, salonUser, loading,
      role, salonId, staffId, isOwner, canSeeRevenue,
      readScope, editScope,
      getReadableStaffIds, getEditableStaffIds,
      canReadStaff, canEditStaff,
      signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
