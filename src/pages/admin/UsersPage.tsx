import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';
import { useStaff } from '../../hooks/useStaff';
import { Card, CardSection } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, Staff } from '../../lib/types';

import { API_BASE } from '../../lib/config';

import type { PermissionScope } from '../../contexts/AuthContext';
import { Toggle } from '../../components/ui/Toggle';

interface SalonUserRecord {
  id: string;
  user_id: string;
  staff_id: string | null;
  role: 'owner' | 'staff';
  display_name: string | null;
  can_see_revenue: boolean;
  read_scope: PermissionScope;
  edit_scope: PermissionScope;
  readable_staff_ids: string[];
  editable_staff_ids: string[];
  created_at: string;
  email: string | null;
  last_sign_in: string | null;
}

const scopeLabels: Record<PermissionScope, string> = {
  all: 'Alles',
  specific: 'Specifieke medewerkers',
  self: 'Alleen eigen',
};
const scopeOrder: Record<PermissionScope, number> = { self: 0, specific: 1, all: 2 };

function PermissionsModal({
  user: u,
  staffList,
  open,
  onClose,
  onSave,
}: {
  user: SalonUserRecord;
  staffList: Staff[];
  open: boolean;
  onClose: () => void;
  onSave: (perms: { readScope: PermissionScope; editScope: PermissionScope; readableStaffIds: string[]; editableStaffIds: string[]; canSeeRevenue: boolean }) => Promise<void>;
}) {
  const [readScope, setReadScope] = useState<PermissionScope>(u.read_scope);
  const [editScope, setEditScope] = useState<PermissionScope>(u.edit_scope);
  const [readableIds, setReadableIds] = useState<string[]>(u.readable_staff_ids || []);
  const [editableIds, setEditableIds] = useState<string[]>(u.editable_staff_ids || []);
  const [canSeeRevenue, setCanSeeRevenue] = useState(u.can_see_revenue);
  const [saving, setSaving] = useState(false);

  // When read scope narrows, also narrow edit scope
  const handleReadScopeChange = (scope: PermissionScope) => {
    setReadScope(scope);
    if (scopeOrder[editScope] > scopeOrder[scope]) {
      setEditScope(scope);
    }
  };

  const toggleReadStaff = (id: string) => {
    setReadableIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleEditStaff = (id: string) => {
    setEditableIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ readScope, editScope, readableStaffIds: readableIds, editableStaffIds: editableIds, canSeeRevenue });
    setSaving(false);
  };

  // Filter edit scope options: cannot exceed read scope
  const editScopeOptions: PermissionScope[] = (['self', 'specific', 'all'] as PermissionScope[]).filter(
    s => scopeOrder[s] <= scopeOrder[readScope]
  );

  return (
    <Modal open={open} onClose={onClose} title={`Rechten — ${u.display_name || u.email}`}>
      <div className="space-y-5">
        {/* Read scope */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Inzien</label>
          <p className="text-[11px] text-gray-400 mb-2">Welke boekingen en agenda-items kan deze medewerker zien?</p>
          <div className="flex gap-1.5">
            {(['self', 'specific', 'all'] as PermissionScope[]).map(scope => (
              <button
                key={scope}
                onClick={() => handleReadScopeChange(scope)}
                className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-all ${
                  readScope === scope
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                {scopeLabels[scope]}
              </button>
            ))}
          </div>
          {readScope === 'specific' && (
            <div className="mt-3 space-y-1.5">
              {staffList.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={readableIds.includes(s.id) || s.id === u.staff_id}
                    disabled={s.id === u.staff_id}
                    onChange={() => toggleReadStaff(s.id)}
                    className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className={`text-[13px] ${s.id === u.staff_id ? 'text-gray-400' : 'text-gray-700'}`}>
                    {s.name} {s.id === u.staff_id ? '(eigen)' : ''}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Edit scope */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Bewerken</label>
          <p className="text-[11px] text-gray-400 mb-2">Welke boekingen kan deze medewerker aanmaken, wijzigen of annuleren?</p>
          <div className="flex gap-1.5">
            {editScopeOptions.map(scope => (
              <button
                key={scope}
                onClick={() => setEditScope(scope)}
                className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-all ${
                  editScope === scope
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                {scopeLabels[scope]}
              </button>
            ))}
          </div>
          {editScope === 'specific' && (
            <div className="mt-3 space-y-1.5">
              {staffList.filter(s => readScope === 'all' || readableIds.includes(s.id) || s.id === u.staff_id).map(s => (
                <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={editableIds.includes(s.id) || s.id === u.staff_id}
                    disabled={s.id === u.staff_id}
                    onChange={() => toggleEditStaff(s.id)}
                    className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className={`text-[13px] ${s.id === u.staff_id ? 'text-gray-400' : 'text-gray-700'}`}>
                    {s.name} {s.id === u.staff_id ? '(eigen)' : ''}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Revenue toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div>
            <div className="text-[13px] font-semibold text-gray-700">Financien inzien</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Omzet, bedragen en statistieken</div>
          </div>
          <Toggle checked={canSeeRevenue} onChange={setCanSeeRevenue} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuleren</Button>
          <Button onClick={handleSave} loading={saving}>Opslaan</Button>
        </div>
      </div>
    </Modal>
  );
}

export function UsersPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { session, user: currentUser } = useAuth();
  const { staff } = useStaff(salon?.id);
  const { addToast } = useToast();

  const [users, setUsers] = useState<SalonUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'staff'>('staff');
  const [inviteStaffId, setInviteStaffId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<SalonUserRecord | null>(null);
  const [removing, setRemoving] = useState(false);
  const [permUser, setPermUser] = useState<SalonUserRecord | null>(null);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  }), [session]);

  const fetchUsers = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
    setLoading(false);
  }, [session, authHeaders]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/invite-user`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
          staffId: inviteStaffId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || 'Uitnodiging mislukt');
      } else {
        addToast('success', data.inviteSent !== false
          ? `Uitnodiging verstuurd naar ${inviteEmail}`
          : 'Account aangemaakt (e-mail kon niet worden verstuurd)');
        setInviteOpen(false);
        setInviteEmail('');
        setInviteName('');
        setInviteRole('staff');
        setInviteStaffId('');
        fetchUsers();
      }
    } catch {
      addToast('error', 'Uitnodiging mislukt');
    }
    setInviting(false);
  };

  const handleRemove = async (u: SalonUserRecord) => {
    setRemoving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/remove-user`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId: u.user_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || 'Verwijdering mislukt');
      } else {
        addToast('success', `${u.display_name || u.email} verwijderd`);
        setConfirmRemove(null);
        fetchUsers();
      }
    } catch {
      addToast('error', 'Verwijdering mislukt');
    }
    setRemoving(false);
  };

  const handleRoleChange = async (u: SalonUserRecord, newRole: 'owner' | 'staff') => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/update-user-role`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId: u.user_id, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || 'Rol wijzigen mislukt');
      } else {
        addToast('success', `Rol gewijzigd naar ${newRole === 'owner' ? 'eigenaar' : 'medewerker'}`);
        fetchUsers();
      }
    } catch {
      addToast('error', 'Rol wijzigen mislukt');
    }
  };

  const handleSavePermissions = async (userId: string, perms: { readScope: PermissionScope; editScope: PermissionScope; readableStaffIds: string[]; editableStaffIds: string[]; canSeeRevenue: boolean }) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/update-user-permissions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          userId,
          readScope: perms.readScope,
          editScope: perms.editScope,
          readableStaffIds: perms.readableStaffIds,
          editableStaffIds: perms.editableStaffIds,
          canSeeRevenue: perms.canSeeRevenue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || 'Rechten wijzigen mislukt');
      } else {
        addToast('success', 'Rechten opgeslagen');
        setPermUser(null);
        fetchUsers();
      }
    } catch {
      addToast('error', 'Rechten wijzigen mislukt');
    }
  };

  const getStaffName = (staffId: string | null) => {
    if (!staffId) return null;
    return staff.find(s => s.id === staffId)?.name || null;
  };

  if (!salon) return null;
  if (loading) return <Spinner className="py-12" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Gebruikers</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{users.length} gebruiker{users.length !== 1 ? 's' : ''} met toegang</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Uitnodigen
        </Button>
      </div>

      {/* User list */}
      <div className="space-y-2">
        {users.map(u => {
          const isMe = u.user_id === currentUser?.id;
          const linkedStaff = getStaffName(u.staff_id);

          return (
            <div
              key={u.id}
              className="bg-white rounded-xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-200 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-bold flex-shrink-0 ${
                    u.role === 'owner'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {(u.display_name || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-gray-900 truncate">
                        {u.display_name || u.email}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">Jij</span>
                      )}
                    </div>
                    <div className="text-[12px] text-gray-400 truncate mt-0.5">{u.email}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        u.role === 'owner'
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'owner' ? 'Eigenaar' : 'Medewerker'}
                      </span>
                      {linkedStaff && (
                        <span className="text-[11px] text-gray-400">
                          Gekoppeld aan {linkedStaff}
                        </span>
                      )}
                      {u.last_sign_in && (
                        <span className="text-[11px] text-gray-400">
                          Laatst actief: {format(parseISO(u.last_sign_in), 'd MMM', { locale: nl })}
                        </span>
                      )}
                      {u.role === 'staff' && (
                        <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                          {scopeLabels[u.read_scope]}{u.can_see_revenue ? ' + financien' : ''}
                        </span>
                      )}
                      {!u.last_sign_in && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Nog niet ingelogd</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {!isMe && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {u.role === 'staff' && (
                      <button
                        onClick={() => setPermUser(u)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        title="Rechten"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </button>
                    )}
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value as 'owner' | 'staff')}
                      className="text-[12px] font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 appearance-none cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <option value="staff">Medewerker</option>
                      <option value="owner">Eigenaar</option>
                    </select>
                    <button
                      onClick={() => setConfirmRemove(u)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Verwijderen"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {users.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-gray-600">Geen gebruikers gevonden</p>
        </div>
      )}

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Gebruiker uitnodigen">
        <div className="space-y-4">
          <Input
            label="Naam"
            value={inviteName}
            onChange={e => setInviteName(e.target.value)}
            placeholder="Volledige naam"
            required
          />
          <Input
            label="E-mailadres"
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="naam@voorbeeld.nl"
            required
          />
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Rol</label>
            <div className="flex gap-2">
              {(['staff', 'owner'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={`flex-1 px-4 py-3 rounded-xl text-[13px] font-semibold border-2 transition-all ${
                    inviteRole === r
                      ? 'border-violet-500 bg-violet-50/50 text-violet-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {r === 'owner' ? 'Eigenaar' : 'Medewerker'}
                  <span className="block text-[11px] font-normal text-gray-400 mt-0.5">
                    {r === 'owner' ? 'Volledige toegang' : 'Alleen agenda en klanten'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {inviteRole === 'staff' && staff.length > 0 && (
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Koppel aan medewerker (optioneel)</label>
              <select
                value={inviteStaffId}
                onChange={e => setInviteStaffId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 hover:border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 transition-all appearance-none"
              >
                <option value="">Geen koppeling</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-violet-50 rounded-xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5 text-violet-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <p className="text-[12px] text-violet-700 leading-relaxed">
              Er wordt een uitnodigingsmail verstuurd. De gebruiker stelt eerst een wachtwoord in en kan daarna inloggen.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Annuleren</Button>
            <Button onClick={handleInvite} loading={inviting} disabled={!inviteEmail.trim() || !inviteName.trim()}>
              Uitnodiging versturen
            </Button>
          </div>
        </div>
      </Modal>

      {/* Permissions modal */}
      {permUser && (
        <PermissionsModal
          user={permUser}
          staffList={staff}
          open={!!permUser}
          onClose={() => setPermUser(null)}
          onSave={(perms) => handleSavePermissions(permUser.user_id, perms)}
        />
      )}

      {/* Confirm remove modal */}
      {confirmRemove && (
        <Modal open={!!confirmRemove} onClose={() => setConfirmRemove(null)} title="Gebruiker verwijderen">
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-[13px] text-red-800">
                Weet je zeker dat je <strong>{confirmRemove.display_name || confirmRemove.email}</strong> wilt verwijderen?
                {confirmRemove.role === 'owner' && ' Deze persoon is eigenaar.'}
              </p>
              <p className="text-[12px] text-red-600 mt-1">
                De gebruiker verliest direct alle toegang tot het dashboard.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setConfirmRemove(null)}>Annuleren</Button>
              <Button variant="danger" onClick={() => handleRemove(confirmRemove)} loading={removing}>
                Verwijderen
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
