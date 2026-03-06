import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';

interface EmailLog {
  id: string;
  salon_id: string;
  booking_id: string | null;
  waitlist_id: string | null;
  type: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  to_email: string;
  customer_name: string | null;
  subject: string | null;
  body_preview: string | null;
  body_html: string | null;
  error_message: string | null;
  meta?: any;
  created_at: string;
  sent_at: string | null;
}

const typeLabels: Record<string, string> = {
  confirmation: 'Bevestiging',
  reminder_24h: 'Herinnering 24u',
  reminder_1h: 'Herinnering 1u',
  cancellation: 'Annulering',
  review_request: 'Review',
  waitlist: 'Wachtlijst',
};

const statusLabels: Record<string, string> = {
  sent: 'Verzonden',
  failed: 'Mislukt',
  skipped: 'Uitgeschakeld',
  queued: 'In wachtrij',
};

const statusStyles: Record<string, { bg: string; text: string; icon: string; border: string }> = {
  sent: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✓', border: 'border-l-emerald-400' },
  failed: { bg: 'bg-red-50', text: 'text-red-600', icon: '×', border: 'border-l-red-400' },
  skipped: { bg: 'bg-gray-100', text: 'text-gray-500', icon: '×', border: 'border-l-gray-300' },
  queued: { bg: 'bg-amber-50', text: 'text-amber-700', icon: '•', border: 'border-l-amber-400' },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommunicationsPage() {
  const { salonId } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EmailLog | null>(null);

  const fetchLogs = async () => {
    if (!salonId) return;
    setLoading(true);

    let q = supabase
      .from('email_logs')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (typeFilter !== 'all') q = q.eq('type', typeFilter);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);

    const { data, error } = await q;
    if (error) console.error('Fetch email logs error:', error);
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [salonId, typeFilter, statusFilter]);

  const filtered = useMemo(() => {
    if (!query.trim()) return logs;
    const q = query.toLowerCase();
    return logs.filter(l =>
      (l.subject || '').toLowerCase().includes(q) ||
      (l.to_email || '').toLowerCase().includes(q) ||
      (l.customer_name || '').toLowerCase().includes(q)
    );
  }, [logs, query]);

  const typeOptions = [
    { value: 'all', label: 'Alles' },
    { value: 'confirmation', label: 'Bevestiging' },
    { value: 'reminder_24h', label: 'Reminder 24u' },
    { value: 'reminder_1h', label: 'Reminder 1u' },
    { value: 'cancellation', label: 'Annulering' },
    { value: 'review_request', label: 'Review' },
    { value: 'waitlist', label: 'Wachtlijst' },
  ];

  const statusOptions = [
    { value: 'all', label: 'Alle statussen' },
    { value: 'sent', label: 'Verzonden' },
    { value: 'failed', label: 'Mislukt' },
    { value: 'skipped', label: 'Uitgeschakeld' },
    { value: 'queued', label: 'Wachtrij' },
  ];

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Communicatie</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Alle klantmails, inclusief status per verzending</p>
          <p className="text-[11px] text-gray-400 mt-1">{filtered.length} berichten</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            Vernieuwen
          </button>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek op naam, email of onderwerp"
              className="w-full sm:w-[260px] px-3 py-2 text-[13px] rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {typeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
                typeFilter === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Spinner className="py-12" />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200/70 rounded-2xl p-8 text-center text-gray-500">
          Geen communicatie gevonden.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const status = statusStyles[log.status] || statusStyles.failed;
            return (
              <div
                key={log.id}
                className={`bg-white border border-gray-200/70 ${status.border} border-l-4 rounded-2xl px-4 py-3 flex items-start gap-3 hover:border-gray-300 transition-colors`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${status.bg} ${status.text}`}
                  title={statusLabels[log.status] || log.status}
                >
                  {status.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">
                        {log.subject || 'Zonder onderwerp'}
                      </p>
                      {log.body_preview && (
                        <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">{log.body_preview}</p>
                      )}
                      <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {typeLabels[log.type] || log.type}
                        </span>
                        <span>{log.customer_name || log.to_email}</span>
                        <span className="text-gray-300">•</span>
                        <span>{log.to_email}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-3">
                        <span>{formatDateTime(log.sent_at || log.created_at)}</span>
                        {log.booking_id && (
                          <a
                            href={`/admin/bookings?booking=${log.booking_id}`}
                            className="text-violet-600 hover:text-violet-700"
                          >
                            Boeking
                          </a>
                        )}
                        {log.waitlist_id && (
                          <a
                            href="/admin/waitlist"
                            className="text-violet-600 hover:text-violet-700"
                          >
                            Wachtlijst
                          </a>
                        )}
                      </div>
                      {log.error_message && log.status !== 'sent' && (
                        <div className="text-[11px] text-red-500 mt-1 truncate">{log.error_message}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                        {statusLabels[log.status] || log.status}
                      </span>
                      <button
                        onClick={() => setSelected(log)}
                        className="text-xs font-medium text-violet-600 hover:text-violet-700 whitespace-nowrap"
                      >
                        Bekijk
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.subject || 'Communicatie'}
        size="lg"
        footer={selected?.status !== 'sent' && selected?.error_message ? (
          <div className="text-[12px] text-red-600">{selected.error_message}</div>
        ) : null}
      >
        {selected && (
          <div className="space-y-4">
            <div className="text-[12px] text-gray-500 space-y-0.5">
              <div><strong>Status:</strong> {statusLabels[selected.status] || selected.status}</div>
              <div><strong>Type:</strong> {typeLabels[selected.type] || selected.type}</div>
              <div><strong>Ontvanger:</strong> {selected.to_email}</div>
              <div><strong>Verzonden:</strong> {selected.sent_at ? formatDateTime(selected.sent_at) : '—'}</div>
              <div><strong>Aangemaakt:</strong> {formatDateTime(selected.created_at)}</div>
              {selected.booking_id && (
                <div>
                  <strong>Boeking:</strong>{' '}
                  <a className="text-violet-600 hover:text-violet-700" href={`/admin/bookings?booking=${selected.booking_id}`}>Open boeking</a>
                </div>
              )}
              {selected.waitlist_id && (
                <div>
                  <strong>Wachtlijst:</strong>{' '}
                  <a className="text-violet-600 hover:text-violet-700" href="/admin/waitlist">Open wachtlijst</a>
                </div>
              )}
            </div>
            <div className="border border-gray-200/70 rounded-xl overflow-hidden">
              {selected.body_html ? (
                <div className="p-4 text-[13px] text-gray-700" dangerouslySetInnerHTML={{ __html: selected.body_html }} />
              ) : (
                <div className="p-4 text-[13px] text-gray-500">{selected.body_preview || 'Geen inhoud beschikbaar'}</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
