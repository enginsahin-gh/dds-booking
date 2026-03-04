import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useAuth } from '../../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.bellure.nl';

interface WaitlistEntry {
  id: string;
  salon_id: string;
  service_id: string;
  staff_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_date: string;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  status: 'waiting' | 'notified' | 'booked' | 'expired' | 'cancelled';
  notified_at: string | null;
  expires_at: string | null;
  created_at: string;
  services?: { name: string } | null;
  staff?: { name: string } | null;
}

type StatusFilter = 'all' | 'waiting' | 'notified' | 'expired' | 'cancelled';

const statusLabels: Record<string, string> = {
  waiting: 'Wachtend',
  notified: 'Genotificeerd',
  booked: 'Geboekt',
  expired: 'Verlopen',
  cancelled: 'Geannuleerd',
};

const statusColors: Record<string, string> = {
  waiting: 'bg-blue-50 text-blue-700',
  notified: 'bg-amber-50 text-amber-700',
  booked: 'bg-emerald-50 text-emerald-700',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-600',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

function formatTimePref(start: string | null, end: string | null): string {
  if (!start && !end) return 'Geen voorkeur';
  if (start === '08:00:00' && end === '12:00:00') return 'Ochtend';
  if (start === '12:00:00' && end === '17:00:00') return 'Middag';
  if (start === '17:00:00' && end === '22:00:00') return 'Avond';
  const fmt = (t: string) => t.slice(0, 5);
  return `${start ? fmt(start) : '?'} - ${end ? fmt(end) : '?'}`;
}

export function WaitlistPage() {
  const { session, salonId } = useAuth();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [notifying, setNotifying] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!session || !salonId) return;

    setLoading(true);
    const token = session.access_token;
    const params = new URLSearchParams({ salon_id: salonId });
    if (statusFilter !== 'all') params.set('status', statusFilter);

    try {
      const res = await fetch(`${API_BASE}/api/waitlist/entries?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Fetch waitlist error:', err);
    }
    setLoading(false);
  }, [session, salonId, statusFilter]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleNotify = async (entryId: string) => {
    if (!session) return;
    setNotifying(entryId);

    try {
      const token = session.access_token;
      const res = await fetch(`${API_BASE}/api/waitlist/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ waitlistId: entryId }),
      });

      if (res.ok) {
        // Refresh list
        await fetchEntries();
      }
    } catch (err) {
      console.error('Notify error:', err);
    }
    setNotifying(null);
  };

  const filters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Alles' },
    { value: 'waiting', label: 'Wachtend' },
    { value: 'notified', label: 'Genotificeerd' },
    { value: 'expired', label: 'Verlopen' },
    { value: 'cancelled', label: 'Geannuleerd' },
  ];

  const waitingCount = entries.filter(e => e.status === 'waiting').length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Wachtlijst</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Klanten die wachten op een beschikbare plek
          </p>
        </div>
        {waitingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-full text-sm font-semibold">
            <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            {waitingCount} wachtend{waitingCount !== 1 ? 'en' : 'e'}
          </span>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
              statusFilter === f.value
                ? 'bg-violet-100 text-violet-700'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner className="min-h-[200px]" />
      ) : entries.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 text-sm">Geen wachtlijst entries gevonden</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <Card key={entry.id} className="!p-0">
              <div className="p-4 lg:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 text-[15px] truncate">
                        {entry.customer_name}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${statusColors[entry.status] || 'bg-gray-100 text-gray-500'}`}>
                        {statusLabels[entry.status] || entry.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span className="truncate">{(entry.services as any)?.name || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatDate(entry.preferred_date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatTimePref(entry.preferred_time_start, entry.preferred_time_end)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="truncate">{(entry.staff as any)?.name || 'Geen voorkeur'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{entry.customer_email}</span>
                      <span>{entry.customer_phone}</span>
                      <span>Aangemeld: {formatDateTime(entry.created_at)}</span>
                    </div>

                    {entry.status === 'notified' && entry.expires_at && (
                      <div className="mt-2 text-xs text-amber-600">
                        Notificatie verloopt: {formatDateTime(entry.expires_at)}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex-shrink-0">
                    {entry.status === 'waiting' && (
                      <Button
                        size="sm"
                        onClick={() => handleNotify(entry.id)}
                        disabled={notifying === entry.id}
                      >
                        {notifying === entry.id ? 'Bezig...' : 'Notificeer'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
