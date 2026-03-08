import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import type { Salon, Booking, Service, Staff } from '../../lib/types';

interface Customer {
  email: string;
  name: string;
  phone: string;
  totalBookings: number;
  totalSpentCents: number;
  totalPaidCents: number;
  lastVisit: string;
  firstVisit: string;
  noShows: number;
  cancellations: number;
  bookings: Booking[];
  tags: string[];
  note: string | null;
}

interface CustomerMeta {
  email: string;
  tags: string[];
  note: string | null;
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export function CustomersPage() {
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { getReadableStaffIds, canSeeRevenue } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [meta, setMeta] = useState<CustomerMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sortBy, setSortBy] = useState<'lastVisit' | 'totalSpent' | 'totalBookings'>('lastVisit');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState<string[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);
  const PAGE_SIZE = 1000;

  useEffect(() => {
    if (!salon) return;
    const load = async () => {
      let bookingsQuery = supabase.from('bookings').select('*').eq('salon_id', salon.id).order('start_at', { ascending: false }).limit(PAGE_SIZE);
      const readableIds = getReadableStaffIds();
      if (readableIds !== null) {
        bookingsQuery = bookingsQuery.in('staff_id', readableIds);
      }
      const [bookingsRes, servicesRes, staffRes, metaRes] = await Promise.all([
        bookingsQuery,
        supabase.from('services').select('*').eq('salon_id', salon.id),
        supabase.from('staff').select('*').eq('salon_id', salon.id),
        supabase.from('customer_meta').select('*').eq('salon_id', salon.id),
      ]);
      const data = bookingsRes.data || [];
      setBookings(data);
      setHasMore(data.length === PAGE_SIZE);
      setServices(servicesRes.data || []);
      setStaffList(staffRes.data || []);
      setMeta(metaRes.data || []);
      setLoading(false);
    };
    load();
  }, [salon]);

  const loadMore = async () => {
    if (!salon || !hasMore || loadingMore) return;
    setLoadingMore(true);
    const lastBooking = bookings[bookings.length - 1];
    let moreQuery = supabase
      .from('bookings')
      .select('*')
      .eq('salon_id', salon.id)
      .order('start_at', { ascending: false })
      .lt('start_at', lastBooking.start_at)
      .limit(PAGE_SIZE);
    const readableIds = getReadableStaffIds();
    if (readableIds !== null) {
      moreQuery = moreQuery.in('staff_id', readableIds);
    }
    const { data } = await moreQuery;
    const newData = data || [];
    setBookings(prev => [...prev, ...newData]);
    setHasMore(newData.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const metaMap = useMemo(() => {
    const map = new Map<string, CustomerMeta>();
    meta.forEach((m) => map.set(m.email.toLowerCase(), m));
    return map;
  }, [meta]);

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();

    for (const b of bookings) {
      const key = b.customer_email.toLowerCase();
      let c = map.get(key);
      if (!c) {
        c = {
          email: b.customer_email,
          name: b.customer_name,
          phone: b.customer_phone || '',
          totalBookings: 0,
          totalSpentCents: 0,
          totalPaidCents: 0,
          lastVisit: b.start_at,
          firstVisit: b.start_at,
          noShows: 0,
          cancellations: 0,
          bookings: [],
          tags: [],
          note: null,
        };
        map.set(key, c);
      }

      c.bookings.push(b);
      c.totalBookings++;
      c.name = b.customer_name || c.name;
      c.phone = b.customer_phone || c.phone;

      const svc = services.find(s => s.id === b.service_id);
      if (b.status === 'confirmed') {
        c.totalSpentCents += svc?.price_cents || 0;
      }
      c.totalPaidCents += b.amount_paid_cents || 0;

      if (b.status === 'no_show') c.noShows++;
      if (b.status === 'cancelled') c.cancellations++;

      if (b.start_at > c.lastVisit) c.lastVisit = b.start_at;
      if (b.start_at < c.firstVisit) c.firstVisit = b.start_at;
    }

    let list = Array.from(map.values()).map((c) => {
      const m = metaMap.get(c.email.toLowerCase());
      return {
        ...c,
        tags: m?.tags || [],
        note: m?.note || null,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'lastVisit') return b.lastVisit.localeCompare(a.lastVisit);
      if (sortBy === 'totalSpent') return b.totalSpentCents - a.totalSpentCents;
      return b.totalBookings - a.totalBookings;
    });

    return list;
  }, [bookings, services, search, sortBy, metaMap]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setNoteDraft(selectedCustomer.note || '');
    setTagsDraft(selectedCustomer.tags || []);
  }, [selectedCustomer]);

  const tagOptions = [
    { id: 'new', label: 'Nieuw', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'vip', label: 'VIP', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'warning', label: 'Waarschuwing', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  const saveMeta = async (email: string, updates: Partial<CustomerMeta>) => {
    if (!salon) return;
    setSavingMeta(true);
    const payload = {
      salon_id: salon.id,
      email,
      tags: updates.tags || tagsDraft,
      note: updates.note ?? noteDraft,
    };
    const { data, error } = await supabase
      .from('customer_meta')
      .upsert(payload, { onConflict: 'salon_id,email' })
      .select('*')
      .single();
    if (!error && data) {
      setMeta(prev => {
        const next = prev.filter(m => m.email.toLowerCase() !== email.toLowerCase());
        next.push({ email: data.email, tags: data.tags || [], note: data.note || null });
        return next;
      });
    }
    setSavingMeta(false);
  };

  const toggleTag = async (tagId: string) => {
    if (!selectedCustomer) return;
    const next = tagsDraft.includes(tagId)
      ? tagsDraft.filter(t => t !== tagId)
      : [...tagsDraft, tagId];
    setTagsDraft(next);
    await saveMeta(selectedCustomer.email, { tags: next });
  };

  const historyGroups = useMemo(() => {
    if (!selectedCustomer) return [] as Array<{ label: string; items: Booking[] }>;
    const sorted = [...selectedCustomer.bookings].sort((a, b) => b.start_at.localeCompare(a.start_at));
    const map = new Map<string, Booking[]>();
    sorted.forEach((b) => {
      const key = format(parseISO(b.start_at), 'MMMM yyyy', { locale: nl });
      const list = map.get(key) || [];
      list.push(b);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [selectedCustomer]);

  if (loading) return <Spinner className="py-12" />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Klanten</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{customers.length} klanten</p>
        </div>
      </div>

      {/* Search & sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Zoek op naam, email of telefoon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-[14px] focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all duration-200 placeholder:text-gray-400"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-[14px] focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all duration-200 appearance-none"
        >
          <option value="lastVisit">Laatste bezoek</option>
          {canSeeRevenue && <option value="totalSpent">Meeste omzet</option>}
          <option value="totalBookings">Meeste boekingen</option>
        </select>
      </div>

      {/* Customer list */}
      {customers.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-gray-600">Geen klanten gevonden</p>
          <p className="text-[13px] text-gray-400 mt-1">Klanten verschijnen hier zodra ze een afspraak maken.</p>
        </div>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="space-y-2 md:hidden">
            {customers.map(customer => (
              <div
                key={customer.email}
                onClick={() => setSelectedCustomer(customer)}
                className="bg-white rounded-xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 active:bg-violet-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 truncate">{customer.name}</p>
                    <p className="text-[12px] text-gray-400 truncate mt-0.5">{customer.email}</p>
                    {(customer.tags.length > 0 || customer.noShows > 0 || customer.note) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {customer.tags.map(tag => (
                          <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {tagOptions.find(t => t.id === tag)?.label || tag}
                          </span>
                        ))}
                        {customer.noShows > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                            {customer.noShows}x no-show
                          </span>
                        )}
                        {customer.note && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                            Notitie
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {canSeeRevenue && <p className="text-[14px] font-bold text-gray-900">{formatPrice(customer.totalSpentCents)}</p>}
                    <p className="text-[11px] text-gray-400">{customer.totalBookings} boekingen</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-100">
                  <span className="text-[12px] text-gray-500">
                    Laatste bezoek: {format(parseISO(customer.lastVisit), 'd MMM yyyy', { locale: nl })}
                  </span>
                  {customer.noShows > 0 && (
                    <span className="text-[11px] text-red-500 font-medium">{customer.noShows}x no-show</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <table className="w-full text-[14px]">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider">Klant</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider hidden lg:table-cell">Boekingen</th>
                  {canSeeRevenue && <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider">Omzet</th>}
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider hidden lg:table-cell">Laatste bezoek</th>
                  {canSeeRevenue && <th className="text-right px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider hidden xl:table-cell">Online betaald</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map(customer => (
                  <tr
                    key={customer.email}
                    className="hover:bg-violet-50/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900">{customer.name}</div>
                      <div className="text-[12px] text-gray-400 mt-0.5">{customer.email}</div>
                      {(customer.tags.length > 0 || customer.noShows > 0 || customer.note) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {customer.tags.map(tag => (
                            <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {tagOptions.find(t => t.id === tag)?.label || tag}
                            </span>
                          ))}
                          {customer.noShows > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                              {customer.noShows}x no-show
                            </span>
                          )}
                          {customer.note && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                              Notitie
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="font-semibold">{customer.totalBookings}</span>
                      {customer.noShows > 0 && (
                        <span className="ml-2 text-[11px] text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded-md">{customer.noShows} no-show</span>
                      )}
                    </td>
                    {canSeeRevenue && (
                      <td className="px-5 py-3.5 font-semibold">
                        {formatPrice(customer.totalSpentCents)}
                      </td>
                    )}
                    <td className="px-5 py-3.5 hidden lg:table-cell text-gray-500">
                      {format(parseISO(customer.lastVisit), 'd MMM yyyy', { locale: nl })}
                    </td>
                    {canSeeRevenue && (
                      <td className="px-5 py-3.5 hidden xl:table-cell text-right text-emerald-600 font-semibold">
                        {customer.totalPaidCents > 0 ? formatPrice(customer.totalPaidCents) : '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-violet-600 bg-violet-50 rounded-xl hover:bg-violet-100 transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Laden...' : 'Meer klanten laden'}
          </button>
          <p className="text-[11px] text-gray-400 mt-2">{customers.length} klanten geladen</p>
        </div>
      )}

      {/* Customer detail modal */}
      {selectedCustomer && (
        <Modal
          open={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={selectedCustomer.name}
        >
          <div className="space-y-5">
            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              {selectedCustomer.phone && (
                <>
                  <a
                    href={`tel:${selectedCustomer.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    Bellen
                  </a>
                  <a
                    href={`https://wa.me/${selectedCustomer.phone.replace(/[^0-9+]/g, '').replace(/^0/, '31')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </a>
                </>
              )}
              <a
                href={`mailto:${selectedCustomer.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                E-mail
              </a>
            </div>

            {/* Tags + note */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tags</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tagOptions.map(tag => {
                    const active = tagsDraft.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all ${
                          active ? tag.cls : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                  {selectedCustomer.noShows > 0 && (
                    <span className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      {selectedCustomer.noShows}x no-show
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Snelle notitie</label>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="Interne notitie (bijv. voorkeuren, allergieën, vaste kleur)"
                  className="mt-2 w-full px-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => saveMeta(selectedCustomer.email, { note: noteDraft })}
                    disabled={savingMeta}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-gray-900 text-white hover:bg-black disabled:opacity-60"
                  >
                    {savingMeta ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-[13px] text-gray-500">E-mail</span>
                <span className="text-[14px] font-medium text-gray-900 truncate max-w-[200px]">{selectedCustomer.email}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-[13px] text-gray-500">Telefoon</span>
                <span className="text-[14px] font-medium text-gray-900">{selectedCustomer.phone || 'Niet opgegeven'}</span>
              </div>
            </div>

            {/* Stats */}
            <div className={`grid ${canSeeRevenue ? 'grid-cols-3' : 'grid-cols-1'} gap-3`}>
              <div className="bg-gray-50 rounded-xl p-3.5 text-center">
                <p className="text-xl font-bold text-gray-900">{selectedCustomer.totalBookings}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">Boekingen</p>
              </div>
              {canSeeRevenue && (
                <div className="bg-gray-50 rounded-xl p-3.5 text-center">
                  <p className="text-xl font-bold text-gray-900">{formatPrice(selectedCustomer.totalSpentCents)}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">Totale omzet</p>
                </div>
              )}
              {canSeeRevenue && (
                <div className="bg-emerald-50 rounded-xl p-3.5 text-center">
                  <p className="text-xl font-bold text-emerald-600">{formatPrice(selectedCustomer.totalPaidCents)}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">Online betaald</p>
                </div>
              )}
            </div>

            {selectedCustomer.noShows > 0 && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-[13px] text-red-700 font-medium">{selectedCustomer.noShows}x no-show · {selectedCustomer.cancellations}x geannuleerd</span>
              </div>
            )}

            {/* Booking history */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Geschiedenis</label>
              <div className="mt-2.5 max-h-64 overflow-y-auto space-y-4">
                {historyGroups.map(group => (
                  <div key={group.label}>
                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.label}</div>
                    <div className="space-y-2">
                      {group.items.map(b => {
                        const svc = services.find(s => s.id === b.service_id);
                        const stf = staffList.find(s => s.id === b.staff_id);
                        const statusStyles: Record<string, string> = {
                          confirmed: 'text-emerald-600',
                          pending_payment: 'text-amber-600',
                          cancelled: 'text-red-500',
                          no_show: 'text-gray-500',
                        };
                        const statusLabels: Record<string, string> = {
                          confirmed: 'Bevestigd',
                          pending_payment: 'Wacht op betaling',
                          cancelled: 'Geannuleerd',
                          no_show: 'No-show',
                        };
                        return (
                          <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                            <div>
                              <div className="text-[13px] font-medium text-gray-900">{svc?.name || '-'}</div>
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                {format(parseISO(b.start_at), 'd MMM yyyy HH:mm', { locale: nl })} · {stf?.name || '-'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[13px] font-semibold">{formatPrice(svc?.price_cents || 0)}</div>
                              <div className={`text-[11px] font-medium ${statusStyles[b.status] || 'text-gray-500'}`}>
                                {statusLabels[b.status] || b.status}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[12px] text-gray-400">
              Klant sinds {format(parseISO(selectedCustomer.firstVisit), 'd MMMM yyyy', { locale: nl })}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
