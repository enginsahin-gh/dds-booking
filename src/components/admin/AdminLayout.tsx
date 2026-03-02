import { useState, useRef, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { useSalon } from '../../hooks/useSalon';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { NotificationCenter } from './NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!currentPassword) { setError('Vul je huidige wachtwoord in'); return; }
    if (password.length < 8) { setError('Nieuw wachtwoord: minimaal 8 tekens'); return; }
    if (password !== confirm) { setError('Wachtwoorden komen niet overeen'); return; }
    setSaving(true);

    // Verify current password by re-authenticating
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user?.email || '',
      password: currentPassword,
    });
    if (signInErr) {
      setError('Huidig wachtwoord is onjuist');
      setSaving(false);
      return;
    }

    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      addToast('success', 'Wachtwoord gewijzigd');
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
      onClose();
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Wachtwoord wijzigen">
      <div className="space-y-4">
        <p className="text-[13px] text-gray-500">Vul eerst je huidige wachtwoord in om te bevestigen.</p>
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span className="text-[13px] text-red-700">{error}</span>
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-semibold text-gray-700">Huidig wachtwoord</label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Je huidige wachtwoord"
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all"
          />
        </div>
        <div className="border-t border-gray-100 pt-4 space-y-1.5">
          <label className="block text-[13px] font-semibold text-gray-700">Nieuw wachtwoord</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Minimaal 8 tekens"
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13px] font-semibold text-gray-700">Herhaal nieuw wachtwoord</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Nogmaals invoeren"
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuleren</Button>
          <Button onClick={handleSave} loading={saving}>Opslaan</Button>
        </div>
      </div>
    </Modal>
  );
}

function ProfileMenu() {
  const { user, salonUser, signOut, isOwner } = useAuth();
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const initial = (salonUser?.display_name || user?.email || '?')[0].toUpperCase();
  const displayName = salonUser?.display_name || user?.email || '';
  const roleLabel = isOwner ? 'Eigenaar' : 'Medewerker';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-[12px] font-bold text-violet-700">
          {initial}
        </div>
        <div className="hidden lg:block text-left">
          <div className="text-[13px] font-semibold text-gray-700 leading-tight truncate max-w-[120px]">{displayName}</div>
          <div className="text-[10px] text-gray-400 font-medium">{roleLabel}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 hidden lg:block"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 py-1.5 w-56">
          {/* Profile header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-[13px] font-semibold text-gray-900 truncate">{displayName}</div>
            <div className="text-[11px] text-gray-400 truncate mt-0.5">{user?.email}</div>
            <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isOwner ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {roleLabel}
            </span>
          </div>

          {/* Menu items */}
          {isOwner && (
            <Link
              to="/admin/users"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
              Gebruikersbeheer
            </Link>
          )}

          {isOwner && (
            <Link
              to="/admin/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
              Instellingen
            </Link>
          )}

          <button
            onClick={() => { setOpen(false); setPasswordOpen(true); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Wachtwoord wijzigen
          </button>

          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Uitloggen
            </button>
          </div>
        </div>
      )}

      <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}

export function AdminLayout() {
  const { user, signOut, salonId, isOwner, role } = useAuth();
  const { salon } = useSalon(undefined, undefined, salonId ?? undefined);
  const { notifications, unreadCount, markAllRead, clearAll, requestPermission, permissionState } = useNotifications(salon?.id);

  return (
    <div className="flex h-[100dvh] bg-gray-50">
      <Sidebar salonId={salon?.id} role={role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - desktop */}
        <header className="hidden lg:flex h-14 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {salon && (
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                <h2 className="text-[13px] font-semibold text-gray-700">{salon.name}</h2>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={markAllRead}
              onClearAll={clearAll}
              onRequestPermission={requestPermission}
              permissionState={permissionState}
            />
            <ProfileMenu />
          </div>
        </header>

        {/* Header - mobile */}
        <header className="lg:hidden flex h-13 border-b border-gray-100 bg-white items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-[11px] font-bold text-white shadow-[0_2px_6px_rgba(124,58,237,0.3)]">B</div>
            {salon && <h2 className="text-[14px] font-bold text-gray-900 truncate">{salon.name}</h2>}
          </div>
          <div className="flex items-center gap-0.5">
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={markAllRead}
              onClearAll={clearAll}
              onRequestPermission={requestPermission}
              permissionState={permissionState}
            />
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="p-4 lg:p-6 max-w-6xl">
            <Outlet context={{ salon, user, isOwner, role }} />
          </div>
        </main>
      </div>
    </div>
  );
}
