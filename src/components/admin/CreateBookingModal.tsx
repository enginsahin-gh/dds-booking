import { useState, useEffect, useMemo, useRef } from 'react';
import { format, addMinutes, parseISO, startOfDay, set } from 'date-fns';
import { nl } from 'date-fns/locale';
import { fromZonedTime } from 'date-fns-tz';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import type { Service, Staff, Salon } from '../../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  salon: Salon;
  services: Service[];
  staff: Staff[];
  prefillDate?: Date;
  prefillStaffId?: string;
  prefillTime?: string;
}

interface KnownCustomer {
  name: string;
  email: string;
  phone: string;
}

const inputClass = `w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200
  focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10
  hover:border-gray-300 transition-all duration-200 placeholder:text-gray-400`;

const selectClass = `w-full appearance-none px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200
  focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10
  hover:border-gray-300 transition-all duration-200`;

function SelectChevron() {
  return (
    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

export function CreateBookingModal({
  open, onClose, onCreated, salon, services, staff,
  prefillDate, prefillStaffId, prefillTime,
}: Props) {
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Customer search
  const [knownCustomers, setKnownCustomers] = useState<KnownCustomer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomerIdx, setSelectedCustomerIdx] = useState(-1);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch known customers on open
  useEffect(() => {
    if (!open || !salon) return;
    supabase
      .from('bookings')
      .select('customer_name, customer_email, customer_phone')
      .eq('salon_id', salon.id)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        // Deduplicate by email, keep latest
        const map = new Map<string, KnownCustomer>();
        for (const b of data) {
          const key = b.customer_email.toLowerCase();
          if (!map.has(key) && !key.includes('@admin.local')) {
            map.set(key, {
              name: b.customer_name,
              email: b.customer_email,
              phone: b.customer_phone || '',
            });
          }
        }
        setKnownCustomers(Array.from(map.values()));
      });
  }, [open, salon]);

  const filteredCustomers = useMemo(() => {
    if (!name || name.length < 2) return [];
    const q = name.toLowerCase();
    return knownCustomers
      .filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q))
      .slice(0, 5);
  }, [name, knownCustomers]);

  const selectCustomer = (c: KnownCustomer) => {
    setName(c.name);
    setEmail(c.email);
    setPhone(c.phone);
    setShowSuggestions(false);
    setSelectedCustomerIdx(-1);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredCustomers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCustomerIdx(i => Math.min(i + 1, filteredCustomers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCustomerIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedCustomerIdx >= 0) {
      e.preventDefault();
      selectCustomer(filteredCustomers[selectedCustomerIdx]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    if (!showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          nameInputRef.current && !nameInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSuggestions]);

  useEffect(() => {
    if (open) {
      setServiceId('');
      setStaffId(prefillStaffId || '');
      setDate(prefillDate ? format(prefillDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setTime(prefillTime || '09:00');
      setName('');
      setEmail('');
      setPhone('');
      setError('');
      setShowSuggestions(false);
      setSelectedCustomerIdx(-1);
    }
  }, [open, prefillDate, prefillStaffId, prefillTime]);

  const activeServices = useMemo(() => services.filter(s => s.is_active), [services]);
  const activeStaff = useMemo(() => staff.filter(s => s.is_active), [staff]);
  const selectedService = activeServices.find(s => s.id === serviceId);

  const timeOptions = useMemo(() => {
    const options: string[] = [];
    for (let h = 7; h <= 21; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 21 && m > 0) break;
        options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return options;
  }, []);

  const endTime = useMemo(() => {
    if (!selectedService || !time || !date) return null;
    try {
      const [h, m] = time.split(':').map(Number);
      return format(addMinutes(set(startOfDay(parseISO(date)), { hours: h, minutes: m }), selectedService.duration_min), 'HH:mm');
    } catch { return null; }
  }, [selectedService, time, date]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (!serviceId || !staffId || !date || !time || !name) {
      setError('Vul alle verplichte velden in');
      return;
    }

    setSaving(true);

    try {
      const svc = activeServices.find(s => s.id === serviceId)!;
      const [hours, minutes] = time.split(':').map(Number);
      const localDate = set(startOfDay(parseISO(date)), { hours, minutes });
      const startAt = fromZonedTime(localDate, salon.timezone);
      const endAt = addMinutes(startAt, svc.duration_min);

      const { data: conflicts } = await supabase
        .from('bookings')
        .select('id')
        .eq('staff_id', staffId)
        .neq('status', 'cancelled')
        .lt('start_at', endAt.toISOString())
        .gt('end_at', startAt.toISOString());

      if (conflicts && conflicts.length > 0) {
        setError('Er is al een afspraak op dit tijdstip voor deze medewerker');
        setSaving(false);
        return;
      }

      const { error: insertError } = await supabase.from('bookings').insert({
        salon_id: salon.id,
        service_id: serviceId,
        staff_id: staffId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        customer_name: name,
        customer_email: email || `handmatig-${Date.now()}@admin.local`,
        customer_phone: phone || '',
        status: 'confirmed',
        payment_status: 'none',
        payment_type: 'none',
        amount_total_cents: svc.price_cents,
        amount_paid_cents: 0,
        amount_due_cents: svc.price_cents,
        refund_status: 'none',
      });

      if (insertError) throw insertError;

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Kon afspraak niet aanmaken');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nieuwe afspraak"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} fullWidth>Annuleren</Button>
          <Button onClick={() => handleSubmit()} loading={saving} fullWidth>Afspraak aanmaken</Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Service & Staff */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-gray-700">Dienst <span className="text-red-400">*</span></label>
            <div className="relative">
              <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={selectClass}>
                <option value="">Selecteer een dienst</option>
                {activeServices.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.duration_min} min — €{(s.price_cents / 100).toFixed(2)}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-gray-700">Medewerker <span className="text-red-400">*</span></label>
            <div className="relative">
              <select value={staffId} onChange={e => setStaffId(e.target.value)} className={selectClass}>
                <option value="">Selecteer een medewerker</option>
                {activeStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        </div>

        {/* Date & Time — stacked on mobile, side-by-side on larger */}
        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-gray-700">Datum <span className="text-red-400">*</span></label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-gray-700">Tijd <span className="text-red-400">*</span></label>
            <div className="relative">
              <select value={time} onChange={e => setTime(e.target.value)} className={selectClass}>
                {timeOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        </div>

        {/* End time preview */}
        {selectedService && endTime && (
          <div className="flex items-center gap-2.5 bg-violet-50 rounded-xl px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-600 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="text-[13px] text-violet-700 font-medium">
              {selectedService.name} — {time} tot {endTime} ({selectedService.duration_min} min)
            </span>
          </div>
        )}

        {/* Customer info */}
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Klantgegevens</span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>
          <div className="space-y-4">
            {/* Name with autocomplete */}
            <div className="space-y-1.5 relative">
              <label className="block text-[13px] font-semibold text-gray-700">Naam <span className="text-red-400">*</span></label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setShowSuggestions(true); setSelectedCustomerIdx(-1); }}
                onFocus={() => { if (name.length >= 2) setShowSuggestions(true); }}
                onKeyDown={handleNameKeyDown}
                placeholder="Zoek bestaande klant of typ een naam"
                className={inputClass}
                autoComplete="off"
              />
              {/* Suggestions dropdown */}
              {showSuggestions && filteredCustomers.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-gray-100">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Bestaande klanten</span>
                  </div>
                  {filteredCustomers.map((c, i) => (
                    <div
                      key={c.email}
                      onClick={() => selectCustomer(c)}
                      className={`px-3 py-2.5 cursor-pointer transition-colors ${
                        i === selectedCustomerIdx ? 'bg-violet-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-[14px] font-medium text-gray-900">{c.name}</div>
                      <div className="text-[12px] text-gray-500">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-gray-700">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optioneel" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-gray-700">Telefoon</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optioneel" className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-[13px] text-red-700 font-medium">{error}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
