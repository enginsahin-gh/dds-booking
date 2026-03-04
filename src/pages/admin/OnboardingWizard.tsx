import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { Spinner } from '../../components/ui/Spinner';

/* ─── Types ─── */
interface SalonData {
  name: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
}

interface ServiceEntry {
  id?: string;
  name: string;
  price: string;
  duration: string;
}

interface StaffEntry {
  id?: string;
  name: string;
  email: string;
  isOwner?: boolean;
}

interface DaySchedule {
  label: string;
  is_working: boolean;
  start_time: string;
  end_time: string;
}

const DAY_LABELS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

function defaultSchedule(): DaySchedule[] {
  return DAY_LABELS.map((label, i) => ({
    label,
    is_working: i < 6, // Mon-Sat open, Sun closed
    start_time: '09:00',
    end_time: '17:00',
  }));
}

/* ─── Progress bar ─── */
function ProgressBar({ step }: { step: number }) {
  const steps = ['Salongegevens', 'Diensten', 'Medewerkers', 'Openingstijden'];
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        {steps.map((s, i) => {
          const num = i + 1;
          const done = step > num;
          const active = step === num;
          return (
            <div key={s} className="flex flex-col items-center flex-1">
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold transition-all
                ${done ? 'bg-violet-600 text-white' : active ? 'bg-violet-600 text-white ring-4 ring-violet-100' : 'bg-gray-200 text-gray-500'}
              `}>
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : num}
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${active ? 'text-violet-700' : 'text-gray-400'} hidden sm:block`}>{s}</span>
            </div>
          );
        })}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-violet-600 rounded-full transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }} />
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function OnboardingWizard() {
  const { user, salonUser, loading: authLoading, salonId } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Step 1
  const [salon, setSalon] = useState<SalonData>({ name: '', address: '', postal_code: '', city: '', phone: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 2
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [newService, setNewService] = useState<ServiceEntry>({ name: '', price: '', duration: '30' });

  // Step 3
  const [staffList, setStaffList] = useState<StaffEntry[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', email: '' });

  // Step 4
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule());

  /* ─── Check if salon is already set up ─── */
  useEffect(() => {
    if (authLoading || !salonId) return;

    async function check() {
      const [{ count: svcCount }, { count: staffCount }] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('salon_id', salonId!),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('salon_id', salonId!),
      ]);

      // Check: has services + staff + at least some schedule via staff
      if ((svcCount ?? 0) > 0 && (staffCount ?? 0) > 0) {
        const { data: staffRows } = await supabase.from('staff').select('id').eq('salon_id', salonId!).limit(1);
        if (staffRows?.length) {
          const { count: sc } = await supabase.from('staff_schedules').select('id', { count: 'exact', head: true }).eq('staff_id', staffRows[0].id);
          if ((sc ?? 0) > 0) {
            navigate('/admin', { replace: true });
            return;
          }
        }
      }
      setCheckingSetup(false);
    }

    check();
  }, [authLoading, salonId, navigate]);

  /* ─── Load existing salon data ─── */
  useEffect(() => {
    if (!salonId) return;
    supabase.from('salons').select('name, address, postal_code, city, phone').eq('id', salonId).single().then(({ data }) => {
      if (data) {
        setSalon(s => ({ ...s, name: data.name || '', address: data.address || '', postal_code: data.postal_code || '', city: data.city || '', phone: data.phone || '' }));
      }
    });
  }, [salonId]);

  /* ─── Load existing staff (owner) — auto-add owner if empty ─── */
  useEffect(() => {
    if (!salonId || !user) return;
    supabase.from('staff').select('id, name').eq('salon_id', salonId).order('sort_order').then(({ data }) => {
      if (data?.length) {
        setStaffList(data.map((s, i) => ({ id: s.id, name: s.name, email: '', isOwner: i === 0 })));
      } else {
        // No staff yet — add the owner as default first staff member
        const ownerName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Eigenaar';
        setStaffList([{ name: ownerName, email: user.email || '', isOwner: true }]);
      }
    });
  }, [salonId, user]);

  /* ─── Handlers ─── */
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const addService = () => {
    if (!newService.name.trim() || !newService.price.trim()) return;
    setServices(prev => [...prev, { ...newService }]);
    setNewService({ name: '', price: '', duration: '30' });
  };

  const removeService = (idx: number) => {
    setServices(prev => prev.filter((_, i) => i !== idx));
  };

  const addStaff = () => {
    if (!newStaff.name.trim()) return;
    setStaffList(prev => [...prev, { name: newStaff.name, email: newStaff.email }]);
    setNewStaff({ name: '', email: '' });
  };

  const removeStaff = (idx: number) => {
    setStaffList(prev => prev.filter((_, i) => i !== idx));
  };

  const updateScheduleDay = (idx: number, patch: Partial<DaySchedule>) => {
    setSchedule(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  };

  /* ─── Save functions per step ─── */
  const saveStep1 = useCallback(async () => {
    if (!salonId) return;
    setError('');
    setSaving(true);

    try {
      // Upload logo if provided
      let logoUrl: string | undefined;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `logos/${salonId}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('salon-assets').upload(path, logoFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('salon-assets').getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }

      const update: Record<string, unknown> = {
        name: salon.name,
        address: salon.address || null,
        postal_code: salon.postal_code || null,
        city: salon.city || null,
        phone: salon.phone || null,
      };
      if (logoUrl) update.logo_url = logoUrl;

      const { error: updateErr } = await supabase.from('salons').update(update).eq('id', salonId);
      if (updateErr) throw updateErr;

      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kon salongegevens niet opslaan');
    }
    setSaving(false);
  }, [salonId, salon, logoFile]);

  const saveStep2 = useCallback(async () => {
    if (!salonId) return;
    if (services.length === 0) {
      setError('Voeg minimaal 1 dienst toe');
      return;
    }
    setError('');
    setSaving(true);

    try {
      const rows = services.filter(s => !s.id).map((s, i) => ({
        salon_id: salonId,
        name: s.name,
        price_cents: Math.round(parseFloat(s.price) * 100),
        duration_min: parseInt(s.duration) || 30,
        is_active: true,
        sort_order: i,
      }));

      if (rows.length) {
        const { error: insertErr } = await supabase.from('services').insert(rows);
        if (insertErr) throw insertErr;
      }

      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kon diensten niet opslaan');
    }
    setSaving(false);
  }, [salonId, services]);

  const saveStep3 = useCallback(async () => {
    if (!salonId) return;
    setError('');
    setSaving(true);

    try {
      // Insert new staff (those without id) — owner first with all_services: true
      const newRows = staffList.filter(s => !s.id).map((s, i) => ({
        salon_id: salonId,
        name: s.name,
        is_active: true,
        all_services: true,
        sort_order: s.isOwner ? 0 : i + 1,
      }));

      if (newRows.length) {
        const { error: insertErr } = await supabase.from('staff').insert(newRows);
        if (insertErr) throw insertErr;
      }

      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kon medewerkers niet opslaan');
    }
    setSaving(false);
  }, [salonId, staffList]);

  const saveStep4 = useCallback(async () => {
    if (!salonId) return;
    setError('');
    setSaving(true);

    try {
      // Get all staff for this salon
      const { data: allStaff } = await supabase.from('staff').select('id').eq('salon_id', salonId);
      if (!allStaff?.length) throw new Error('Geen medewerkers gevonden');

      const rows = allStaff.flatMap(staff =>
        schedule.map((day, dayIdx) => ({
          staff_id: staff.id,
          day_of_week: dayIdx, // 0=monday
          start_time: day.start_time + ':00',
          end_time: day.end_time + ':00',
          is_working: day.is_working,
        }))
      );

      const { error: insertErr } = await supabase.from('staff_schedules').insert(rows);
      if (insertErr) throw insertErr;

      navigate('/admin', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kon openingstijden niet opslaan');
    }
    setSaving(false);
  }, [salonId, schedule, navigate]);

  const handleNext = () => {
    setError('');
    if (step === 1) saveStep1();
    else if (step === 2) saveStep2();
    else if (step === 3) saveStep3();
    else if (step === 4) saveStep4();
  };

  const handleBack = () => {
    setError('');
    setStep(s => Math.max(1, s - 1));
  };

  /* ─── Loading states ─── */
  if (authLoading || checkingSetup) return <Spinner className="min-h-screen" />;
  if (!user) { navigate('/admin/login', { replace: true }); return null; }

  return (
    <div className="min-h-[100dvh] bg-gray-50/50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center text-white text-sm font-bold">B</div>
          <span className="text-base font-bold tracking-tight text-gray-900">Bellure</span>
          <span className="text-[13px] text-gray-400 ml-auto">Stap {step} van 4</span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-4 sm:p-6 pt-6 sm:pt-10">
        <div className="w-full max-w-xl">
          <ProgressBar step={step} />

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[13px]">{error}</div>
          )}

          {/* ─── Step 1: Salon details ─── */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-4 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Salongegevens aanvullen</h2>
                <p className="text-[13px] text-gray-500 mt-1">Vul je contactgegevens en adres aan.</p>
              </div>
              <Input label="Salonnaam" value={salon.name} onChange={e => setSalon(s => ({ ...s, name: e.target.value }))} required />
              <Input label="Adres" value={salon.address} onChange={e => setSalon(s => ({ ...s, address: e.target.value }))} placeholder="Straat en huisnummer" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Postcode" value={salon.postal_code} onChange={e => setSalon(s => ({ ...s, postal_code: e.target.value }))} placeholder="1234 AB" />
                <Input label="Stad" value={salon.city} onChange={e => setSalon(s => ({ ...s, city: e.target.value }))} />
              </div>
              <Input label="Telefoonnummer" value={salon.phone} onChange={e => setSalon(s => ({ ...s, phone: e.target.value }))} type="tel" placeholder="06-12345678" />

              {/* Logo upload */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-gray-700">Logo</label>
                <div className="flex items-center gap-4">
                  {logoPreview && (
                    <img src={logoPreview} alt="Logo preview" className="w-14 h-14 rounded-xl object-cover border border-gray-200" />
                  )}
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {logoFile ? 'Wijzig logo' : 'Upload logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </div>
                <p className="text-[12px] text-gray-400">Optioneel · JPG, PNG of SVG</p>
              </div>
            </div>
          )}

          {/* ─── Step 2: Services ─── */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-4 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Diensten toevoegen</h2>
                <p className="text-[13px] text-gray-500 mt-1">Voeg minimaal 1 dienst toe die klanten kunnen boeken.</p>
              </div>

              {/* Existing services list */}
              {services.length > 0 && (
                <div className="space-y-2">
                  {services.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div>
                        <span className="text-[14px] font-medium text-gray-900">{s.name}</span>
                        <span className="text-[13px] text-gray-500 ml-2">€{s.price} · {s.duration} min</span>
                      </div>
                      <button onClick={() => removeService(i)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new service form */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <Input label="Dienstnaam" value={newService.name} onChange={e => setNewService(s => ({ ...s, name: e.target.value }))} placeholder="Bijv. Knippen dames" />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Prijs (€)" value={newService.price} onChange={e => setNewService(s => ({ ...s, price: e.target.value }))} type="number" min="0" step="0.50" placeholder="25.00" />
                  <Input label="Duur (minuten)" value={newService.duration} onChange={e => setNewService(s => ({ ...s, duration: e.target.value }))} type="number" min="5" step="5" placeholder="30" />
                </div>
                <Button variant="secondary" size="sm" onClick={addService} icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                }>
                  Dienst toevoegen
                </Button>
              </div>
            </div>
          )}

          {/* ─── Step 3: Staff ─── */}
          {step === 3 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-4 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Medewerkers</h2>
                <p className="text-[13px] text-gray-500 mt-1">Voeg medewerkers toe. Je staat er zelf al als eerste bij.</p>
              </div>

              {/* Staff list */}
              {staffList.length > 0 && (
                <div className="space-y-2">
                  {staffList.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[13px] font-bold">
                          {s.name[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <span className="text-[14px] font-medium text-gray-900">{s.name}</span>
                          {s.isOwner && <span className="text-[11px] ml-2 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">Eigenaar</span>}
                          {s.email && <span className="text-[12px] text-gray-400 block">{s.email}</span>}
                        </div>
                      </div>
                      {!s.isOwner && !s.id && (
                        <button onClick={() => removeStaff(i)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add staff form */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <Input label="Naam" value={newStaff.name} onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))} placeholder="Naam medewerker" />
                <Input label="E-mail" value={newStaff.email} onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))} placeholder="Optioneel" type="email" hint="Optioneel" />
                <Button variant="secondary" size="sm" onClick={addStaff} icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                }>
                  Medewerker toevoegen
                </Button>
              </div>
            </div>
          )}

          {/* ─── Step 4: Opening hours ─── */}
          {step === 4 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-4 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Openingstijden</h2>
                <p className="text-[13px] text-gray-500 mt-1">Stel de standaard werktijden in. Je kunt dit later per medewerker aanpassen.</p>
              </div>

              <div className="space-y-3">
                {schedule.map((day, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="w-24 flex-shrink-0">
                      <Toggle
                        checked={day.is_working}
                        onChange={checked => updateScheduleDay(i, { is_working: checked })}
                        label={day.label}
                        size="sm"
                      />
                    </div>
                    {day.is_working ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={day.start_time}
                          onChange={e => updateScheduleDay(i, { start_time: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                        />
                        <span className="text-gray-400 text-[13px]">–</span>
                        <input
                          type="time"
                          value={day.end_time}
                          onChange={e => updateScheduleDay(i, { end_time: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                        />
                      </div>
                    ) : (
                      <span className="text-[13px] text-gray-400 italic">Gesloten</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Navigation ─── */}
          <div className="flex items-center justify-between mt-6 pb-8">
            {step > 1 ? (
              <Button variant="secondary" onClick={handleBack} disabled={saving}>Vorige</Button>
            ) : <div />}
            <Button variant="primary" onClick={handleNext} loading={saving}>
              {step === 4 ? 'Voltooien' : 'Volgende'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
