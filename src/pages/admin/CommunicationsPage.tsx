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
  is_read: boolean;
  handled_at: string | null;
  handled_by: string | null;
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
  const { salonId, user } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [handledFilter, setHandledFilter] = useState<'all' | 'open' | 'handled'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EmailLog | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

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

  useEffect(() => {
    setSelectedIds([]);
  }, [typeFilter, statusFilter, handledFilter, query]);

  const filtered = useMemo(() => {
    let data = logs;
    if (handledFilter === 'open') data = data.filter(l => !l.handled_at);
    if (handledFilter === 'handled') data = data.filter(l => !!l.handled_at);
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter(l =>
      (l.subject || '').toLowerCase().includes(q) ||
      (l.to_email || '').toLowerCase().includes(q) ||
      (l.customer_name || '').toLowerCase().includes(q)
    );
  }, [logs, query, handledFilter]);

  const selectedCount = selectedIds.length;
  const allSelected = selectedCount > 0 && selectedCount === filtered.length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(filtered.map(l => l.id));
  };

  const updateLogs = async (ids: string[], updates: Partial<EmailLog>) => {
    if (!salonId || ids.length === 0) return;
    setBulkLoading(true);
    await supabase.from('email_logs').update(updates).in('id', ids);
    await fetchLogs();
    setSelectedIds([]);
    setBulkLoading(false);
  };

  const markRead = (ids: string[]) => updateLogs(ids, { is_read: true });
  const markUnread = (ids: string[]) => updateLogs(ids, { is_read: false });
  const markHandled = (ids: string[]) => updateLogs(ids, { handled_at: new Date().toISOString(), handled_by: user?.id || null });
  const markOpen = (ids: string[]) => updateLogs(ids, { handled_at: null, handled_by: null });

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

  const handledOptions = [
    { value: 'all', label: 'Alles' },
    { value: 'open', label: 'Open' },
    { value: 'handled', label: 'Afgehandeld' },
  ];

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Communicatie</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Alle klantmails, inclusief status per verzending</p>
          <p className="text-[11px] text-gray-400 mt-1">{filtered.length} berichten</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-2 order-2 sm:order-none">
            <button
              onClick={fetchLogs}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            >
              Vernieuwen
            </button>
            {filtered.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              >
                {allSelected ? 'Deselecteer' : 'Selecteer'}
              </button>
            )}
          </div>
          <div className="relative w-full sm:w-[260px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek op naam, email of onderwerp"
              className="w-full px-3 py-2 text-[13px] rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        {/* Mobile dropdowns */}
        <div className="sm:hidden grid grid-cols-2 gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-[12px] font-semibold rounded-xl border border-gray-200 bg-white"
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-[12px] font-semibold rounded-xl border border-gray-200 bg-white"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Desktop chips */}
        <div className="hidden sm:flex gap-1 overflow-x-auto pb-1">
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

        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="flex gap-1 bg-gray-100/70 p-0.5 rounded-full w-full sm:w-auto">
            {handledOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setHandledFilter(opt.value as typeof handledFilter)}
                className={`flex-1 sm:flex-none px-3 py-1 text-[11px] font-semibold rounded-full transition-all ${
                  handledFilter === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="hidden sm:block px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white border border-gray-200/70 rounded-xl px-3 py-2">
          <div className="text-[12px] font-semibold text-gray-700">{selectedCount} geselecteerd</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={bulkLoading}
              onClick={() => markRead(selectedIds)}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-gray-900 text-white hover:bg-black disabled:opacity-60"
            >
              Markeer gelezen
            </button>
            <button
              disabled={bulkLoading}
              onClick={() => markUnread(selectedIds)}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60"
            >
              Ongelezen
            </button>
            <button
              disabled={bulkLoading}
              onClick={() => markHandled(selectedIds)}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Afgehandeld
            </button>
            <button
              disabled={bulkLoading}
              onClick={() => markOpen(selectedIds)}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              Open zetten
            </button>
            <button
              disabled={bulkLoading}
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-60"
            >
              Deselecteer
            </button>
          </div>
        </div>
      )}

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
            const isHandled = !!log.handled_at;
            const isSelected = selectedIds.includes(log.id);
            return (
              <div
                key={log.id}
                className={`bg-white border border-gray-200/70 ${status.border} border-l-4 rounded-2xl px-3 py-2.5 flex items-start gap-3 hover:border-gray-300 transition-colors ${!log.is_read ? 'ring-1 ring-violet-200' : ''}`}
              >
                <div className="pt-1">
                  <label className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => toggleSelect(log.id)}
                    />
                    <span
                      className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-bold ${
                        isSelected ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                  </label>
                </div>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${status.bg} ${status.text}`}
                  title={statusLabels[log.status] || log.status}
                >
                  {status.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!log.is_read && <span className="w-2 h-2 rounded-full bg-violet-500" />}
                        <p className="text-[13px] font-semibold text-gray-900 truncate">
                          {log.subject || 'Zonder onderwerp'}
                        </p>
                        {isHandled && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Afgehandeld</span>
                        )}
                      </div>
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => (log.is_read ? markUnread([log.id]) : markRead([log.id]))}
                          className="text-[11px] font-semibold text-gray-600 hover:text-gray-900"
                        >
                          {log.is_read ? 'Ongelezen' : 'Gelezen'}
                        </button>
                        <button
                          onClick={() => (isHandled ? markOpen([log.id]) : markHandled([log.id]))}
                          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          {isHandled ? 'Open' : 'Afhandelen'}
                        </button>
                      </div>
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
