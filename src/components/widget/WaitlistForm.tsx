import { useState } from 'react';

interface WaitlistFormProps {
  salonId: string;
  serviceId: string;
  staffId: string | null;
  selectedDate: string; // YYYY-MM-DD
}

const FUNCTIONS_BASE = import.meta.env.VITE_API_URL
  || (typeof document !== 'undefined' && document.querySelector('script[data-bellure-origin]')?.getAttribute('data-bellure-origin'))
  || 'https://api.bellure.nl';

type TimePref = '' | 'morning' | 'afternoon' | 'evening';

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

export function WaitlistForm({ salonId, serviceId, staffId, selectedDate }: WaitlistFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [timePref, setTimePref] = useState<TimePref>('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!name.trim() || name.trim().length < 2) e.name = 'Vul je naam in (minimaal 2 tekens)';
    if (!email.trim()) e.email = 'Vul je e-mailadres in';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Ongeldig e-mailadres';
    if (!phone.trim()) e.phone = 'Vul je telefoonnummer in';
    else if (!/^[\d\s\-+()]{7,}$/.test(phone)) e.phone = 'Ongeldig telefoonnummer';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Map time preference to time range
  const getTimeRange = (pref: TimePref): { start?: string; end?: string } => {
    switch (pref) {
      case 'morning': return { start: '08:00', end: '12:00' };
      case 'afternoon': return { start: '12:00', end: '17:00' };
      case 'evening': return { start: '17:00', end: '22:00' };
      default: return {};
    }
  };

  const handleSubmit = async () => {
    if (honeypot) return;
    if (!validate()) return;

    setLoading(true);
    setErrorMsg('');

    const timeRange = getTimeRange(timePref);

    try {
      const res = await fetch(`${FUNCTIONS_BASE}/api/waitlist/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId,
          serviceId,
          staffId: staffId || undefined,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          preferredDate: selectedDate,
          preferredTimeStart: timeRange.start || undefined,
          preferredTimeEnd: timeRange.end || undefined,
          hp: honeypot,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'RATE_LIMITED') {
          setErrorMsg('Je hebt al het maximale aantal wachtlijstplaatsen voor deze salon.');
        } else {
          setErrorMsg('Er ging iets mis. Probeer het opnieuw.');
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setErrorMsg('Er ging iets mis. Probeer het opnieuw.');
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="bellure-animate-in" style={{ marginTop: 16 }}>
        <div style={{
          padding: '20px',
          background: 'var(--bellure-color-success-bg, #F0FDF4)',
          borderRadius: '12px',
          border: '1px solid var(--bellure-color-success-border, #BBF7D0)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', marginBottom: 8 }}>&#10003;</div>
          <p style={{ fontWeight: 600, color: 'var(--bellure-color-success, #166534)', margin: '0 0 4px' }}>
            Je staat op de wachtlijst!
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--bellure-color-text-muted, #64748B)', margin: 0 }}>
            We mailen je zodra er een plek vrijkomt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bellure-animate-in" style={{ marginTop: 16 }}>
      <div style={{
        padding: '20px',
        background: 'var(--bellure-color-bg-subtle, #F8FAFC)',
        borderRadius: '12px',
        border: '1px solid var(--bellure-color-border, #E2E8F0)',
      }}>
        <p style={{ fontWeight: 600, margin: '0 0 4px', fontSize: '0.95rem' }}>
          Wil je op de wachtlijst?
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--bellure-color-text-muted, #64748B)', margin: '0 0 16px' }}>
          We laten je weten zodra er een plek vrijkomt op deze datum.
        </p>

        {errorMsg && (
          <div style={{ padding: '8px 12px', marginBottom: 12, background: '#FEF2F2', borderRadius: 8, color: '#DC2626', fontSize: '0.85rem', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <div className="bellure-form">
          {/* Honeypot */}
          <div className="bellure-form-hp" aria-hidden="true">
            <label>
              Laat dit veld leeg
              <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="bellure-form-group">
            <label className="bellure-form-label">Naam *</label>
            <input
              className={`bellure-form-input ${errors.name ? 'bellure-form-input--error' : ''}`}
              type="text"
              placeholder="Je volledige naam"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            {errors.name && <span className="bellure-form-error">{errors.name}</span>}
          </div>

          <div className="bellure-form-group">
            <label className="bellure-form-label">Telefoonnummer *</label>
            <input
              className={`bellure-form-input ${errors.phone ? 'bellure-form-input--error' : ''}`}
              type="tel"
              placeholder="06 12345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            {errors.phone && <span className="bellure-form-error">{errors.phone}</span>}
          </div>

          <div className="bellure-form-group">
            <label className="bellure-form-label">E-mailadres *</label>
            <input
              className={`bellure-form-input ${errors.email ? 'bellure-form-input--error' : ''}`}
              type="email"
              placeholder="je@email.nl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && <span className="bellure-form-error">{errors.email}</span>}
          </div>

          <div className="bellure-form-group">
            <label className="bellure-form-label">Voorkeur tijdstip</label>
            <select
              className="bellure-form-input"
              value={timePref}
              onChange={(e) => setTimePref(e.target.value as TimePref)}
            >
              <option value="">Geen voorkeur</option>
              <option value="morning">Ochtend (08:00 - 12:00)</option>
              <option value="afternoon">Middag (12:00 - 17:00)</option>
              <option value="evening">Avond (17:00 - 22:00)</option>
            </select>
          </div>

          <button
            className="bellure-btn bellure-btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Bezig...' : 'Op wachtlijst plaatsen'}
          </button>
        </div>
      </div>
    </div>
  );
}
