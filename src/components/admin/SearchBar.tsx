import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';

interface SearchResult {
  type: 'customer' | 'booking';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

interface SearchBarProps {
  salonId: string | undefined;
}

export function SearchBar({ salonId }: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Open/close
  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard shortcut: Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) closeSearch();
        else openSearch();
      }
      if (e.key === 'Escape' && open) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, openSearch, closeSearch]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !salonId) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const searchTerm = `%${query.trim()}%`;
      const items: SearchResult[] = [];

      // Search customers (distinct by email)
      const { data: customers } = await supabase
        .from('bookings')
        .select('customer_name, customer_email, customer_phone')
        .eq('salon_id', salonId)
        .or(`customer_name.ilike.${searchTerm},customer_email.ilike.${searchTerm},customer_phone.ilike.${searchTerm}`)
        .limit(20);

      if (customers) {
        // Deduplicate by email
        const seen = new Set<string>();
        for (const c of customers) {
          const key = c.customer_email.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({
            type: 'customer',
            id: key,
            title: c.customer_name,
            subtitle: [c.customer_email, c.customer_phone].filter(Boolean).join(' · '),
            url: `/admin/customers?search=${encodeURIComponent(c.customer_name)}`,
          });
          if (items.length >= 5) break;
        }
      }

      // Search bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, customer_name, start_at, status')
        .eq('salon_id', salonId)
        .ilike('customer_name', searchTerm)
        .order('start_at', { ascending: false })
        .limit(5);

      if (bookings) {
        for (const b of bookings) {
          const statusLabels: Record<string, string> = {
            confirmed: 'Bevestigd',
            completed: 'Voltooid',
            cancelled: 'Geannuleerd',
            pending_payment: 'Wacht op betaling',
            no_show: 'No-show',
          };
          items.push({
            type: 'booking',
            id: b.id,
            title: b.customer_name,
            subtitle: `${format(parseISO(b.start_at), 'd MMM yyyy HH:mm', { locale: nl })} · ${statusLabels[b.status] || b.status}`,
            url: `/admin/bookings?booking=${b.id}`,
          });
        }
      }

      setResults(items);
      setSelectedIndex(0);
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, salonId]);

  // Navigate on selection
  const handleSelect = useCallback((result: SearchResult) => {
    closeSearch();
    navigate(result.url);
  }, [closeSearch, navigate]);

  // Keyboard navigation in results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  // Group results
  const customerResults = results.filter(r => r.type === 'customer');
  const bookingResults = results.filter(r => r.type === 'booking');

  return (
    <>
      {/* Trigger button - desktop */}
      <button
        onClick={openSearch}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200/80 transition-colors text-[13px] text-gray-500 min-w-[200px]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span className="flex-1 text-left">Zoeken...</span>
        <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[10px] font-semibold text-gray-400">
          ⌘K
        </kbd>
      </button>

      {/* Trigger button - mobile */}
      <button
        onClick={openSearch}
        className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>

      {/* Search modal */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSearch} />

          {/* Dialog */}
          <div className="absolute inset-0 flex items-start justify-center pt-[15vh] px-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Zoek klanten of boekingen..."
                  className="flex-1 text-[15px] text-gray-900 placeholder-gray-400 outline-none bg-transparent"
                  autoComplete="off"
                />
                {loading && (
                  <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                <button onClick={closeSearch} className="text-[12px] font-medium text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded bg-gray-100">
                  Esc
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto">
                {query.trim() && results.length === 0 && !loading && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[14px] text-gray-500">Geen resultaten voor "{query}"</p>
                    <p className="text-[12px] text-gray-400 mt-1">Probeer een andere zoekterm</p>
                  </div>
                )}

                {!query.trim() && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[13px] text-gray-400">Zoek op naam, email of telefoonnummer</p>
                  </div>
                )}

                {/* Customer results */}
                {customerResults.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1.5">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Klanten</span>
                    </div>
                    {customerResults.map((r, i) => {
                      const globalIndex = results.indexOf(r);
                      return (
                        <button
                          key={r.id}
                          onClick={() => handleSelect(r)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            selectedIndex === globalIndex ? 'bg-violet-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-gray-900 truncate">{r.title}</div>
                            <div className="text-[12px] text-gray-400 truncate">{r.subtitle}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Booking results */}
                {bookingResults.length > 0 && (
                  <div className="py-2 border-t border-gray-50">
                    <div className="px-4 py-1.5">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Boekingen</span>
                    </div>
                    {bookingResults.map((r) => {
                      const globalIndex = results.indexOf(r);
                      return (
                        <button
                          key={r.id}
                          onClick={() => handleSelect(r)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            selectedIndex === globalIndex ? 'bg-violet-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-gray-900 truncate">{r.title}</div>
                            <div className="text-[12px] text-gray-400 truncate">{r.subtitle}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer hints */}
              {results.length > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px]">↑↓</kbd>
                    Navigeer
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px]">↵</kbd>
                    Open
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px]">Esc</kbd>
                    Sluiten
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
