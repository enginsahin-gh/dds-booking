import { useState, useEffect, useMemo } from 'react';
import { format, addMinutes, parseISO, startOfDay, set } from 'date-fns';
import { nl } from 'date-fns/locale';
import { fromZonedTime } from 'date-fns-tz';
import { Modal } from '../ui/Modal';
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
  prefillTime?: string; // "HH:mm"
}

export function CreateBookingModal({
  open,
  onClose,
  onCreated,
  salon,
  services,
  staff,
  prefillDate,
  prefillStaffId,
  prefillTime,
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

  // Reset/prefill when opening
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
    }
  }, [open, prefillDate, prefillStaffId, prefillTime]);

  const activeServices = useMemo(() => services.filter(s => s.is_active), [services]);
  const activeStaff = useMemo(() => staff.filter(s => s.is_active), [staff]);
  const selectedService = activeServices.find(s => s.id === serviceId);

  // Generate time options in 15-min intervals
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Check for conflicts
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
    <Modal open={open} onClose={onClose} title="Nieuwe afspraak">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Service */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dienst *</label>
          <select
            value={serviceId}
            onChange={e => setServiceId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          >
            <option value="">Selecteer een dienst</option>
            {activeServices.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.duration_min} min — €{(s.price_cents / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        {/* Staff */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Medewerker *</label>
          <select
            value={staffId}
            onChange={e => setStaffId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          >
            <option value="">Selecteer een medewerker</option>
            {activeStaff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tijd *</label>
            <select
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              {timeOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedService && (
          <div className="bg-violet-50 rounded-lg px-3 py-2 text-sm text-violet-700">
            {selectedService.name} — eindtijd: {time && date
              ? format(addMinutes(set(startOfDay(parseISO(date)), {
                  hours: parseInt(time.split(':')[0]),
                  minutes: parseInt(time.split(':')[1]),
                }), selectedService.duration_min), 'HH:mm')
              : '-'}
          </div>
        )}

        {/* Customer info */}
        <div className="border-t pt-4">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Klantgegevens</label>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Volledige naam"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="optioneel"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefoon</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="optioneel"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? 'Opslaan...' : 'Afspraak aanmaken'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
