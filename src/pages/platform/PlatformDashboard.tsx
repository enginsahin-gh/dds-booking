import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE } from '../../lib/config';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';

interface PlatformSalon {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subscription_status: 'trial' | 'active' | 'paused' | 'cancelled' | 'none';
  trial_started_at: string | null;
  trial_ends_at: string | null;
  plan_type: string | null;
  mollie_connected_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS: Array<{ value: PlatformSalon['subscription_status']; label: string }> = [
  { value: 'trial', label: 'Proef' },
  { value: 'active', label: 'Aangeschaft' },
  { value: 'paused', label: 'Gepauzeerd' },
  { value: 'cancelled', label: 'Opgezegd' },
  { value: 'none', label: 'Geen' },
];

const PLAN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'booking_standalone', label: 'Booking' },
  { value: 'booking_website', label: 'Website & Booking' },
];

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00Z`).toISOString();
}

export function PlatformDashboard() {
  const { session } = useAuth();
  const { addToast } = useToast();
  const [salons, setSalons] = useState<PlatformSalon[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  }), [session]);

  useEffect(() => {
    if (!session) return;
    const fetchSalons = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/platform/salons`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setSalons(data.salons || []);
        } else {
          addToast('error', 'Kon salons niet laden');
        }
      } catch {
        addToast('error', 'Kon salons niet laden');
      }
      setLoading(false);
    };
    fetchSalons();
  }, [session, authHeaders, addToast]);

  const updateSalonField = (id: string, patch: Partial<PlatformSalon>) => {
    setSalons(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  };

  const saveSalon = async (salon: PlatformSalon) => {
    if (!session) return;
    setSavingId(salon.id);
    try {
      const res = await fetch(`${API_BASE}/api/platform/update-salon`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          salonId: salon.id,
          subscription_status: salon.subscription_status,
          trial_ends_at: salon.trial_ends_at,
          plan_type: salon.plan_type,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.salon as Partial<PlatformSalon>;
        setSalons(prev => prev.map(s => (s.id === salon.id ? { ...s, ...updated } : s)));
        addToast('success', 'Status bijgewerkt');
      } else {
        addToast('error', 'Opslaan mislukt');
      }
    } catch {
      addToast('error', 'Opslaan mislukt');
    }
    setSavingId(null);
  };

  if (loading) return <Spinner className="min-h-[40vh]" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Platform beheer</h1>
        <p className="text-[13px] text-gray-500">Overzicht van Bellure‑klanten, status en plan.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Salon</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Trial eind</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Mollie</th>
                <th className="px-4 py-3 font-semibold text-right">Actie</th>
              </tr>
            </thead>
            <tbody>
              {salons.map((salon) => {
                const statusLabel = STATUS_OPTIONS.find(s => s.value === salon.subscription_status)?.label || salon.subscription_status;
                return (
                  <tr key={salon.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{salon.name}</div>
                      <div className="text-[11px] text-gray-400">{new Date(salon.created_at).toLocaleDateString('nl-NL')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{salon.email || '—'}</div>
                      <div className="text-[11px] text-gray-400">{salon.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={salon.subscription_status}
                        onChange={(e) => updateSalonField(salon.id, { subscription_status: e.target.value as PlatformSalon['subscription_status'] })}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px]"
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="text-[11px] text-gray-400 mt-1">{statusLabel}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={toDateInput(salon.trial_ends_at)}
                        onChange={(e) => updateSalonField(salon.id, { trial_ends_at: fromDateInput(e.target.value) })}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={salon.plan_type || ''}
                        onChange={(e) => updateSalonField(salon.id, { plan_type: e.target.value || null })}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] min-w-[160px]"
                      >
                        <option value="">Geen plan</option>
                        {PLAN_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-600">
                      {salon.mollie_connected_at ? 'Gekoppeld' : 'Niet gekoppeld'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => saveSalon(salon)}
                        disabled={savingId === salon.id}
                        className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-50"
                      >
                        {savingId === salon.id ? 'Opslaan...' : 'Opslaan'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
