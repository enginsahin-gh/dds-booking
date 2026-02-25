import { useState } from 'react';

interface CustomerFormProps {
  onSubmit: (data: { name: string; email: string; phone: string; hp?: string }) => void;
  loading: boolean;
  submitLabel?: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

export function CustomerForm({ onSubmit, loading, submitLabel }: CustomerFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!name.trim()) e.name = 'Vul je naam in';
    if (!email.trim()) e.email = 'Vul je e-mailadres in';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Ongeldig e-mailadres';
    if (!phone.trim()) e.phone = 'Vul je telefoonnummer in';
    else if (!/^[\d\s\-+()]{7,}$/.test(phone)) e.phone = 'Ongeldig telefoonnummer';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    // Client-side honeypot check (also validated server-side via create-booking)
    if (honeypot) return;
    if (!validate()) return;
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), hp: honeypot });
  };

  return (
    <div className="dds-animate-in">
      <h3 className="dds-step-title" style={{ fontSize: '1.1rem', marginTop: 8 }}>Jouw gegevens</h3>

      <div className="dds-form">
        {/* Honeypot field — invisible to humans */}
        <div className="dds-form-hp" aria-hidden="true">
          <label>
            Laat dit veld leeg
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>

        <div className="dds-form-group">
          <label className="dds-form-label">Naam *</label>
          <input
            className={`dds-form-input ${errors.name ? 'dds-form-input--error' : ''}`}
            type="text"
            placeholder="Je volledige naam"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          {errors.name && <span className="dds-form-error">{errors.name}</span>}
        </div>

        <div className="dds-form-group">
          <label className="dds-form-label">Telefoonnummer *</label>
          <input
            className={`dds-form-input ${errors.phone ? 'dds-form-input--error' : ''}`}
            type="tel"
            placeholder="06 12345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          {errors.phone && <span className="dds-form-error">{errors.phone}</span>}
        </div>

        <div className="dds-form-group">
          <label className="dds-form-label">E-mailadres *</label>
          <input
            className={`dds-form-input ${errors.email ? 'dds-form-input--error' : ''}`}
            type="email"
            placeholder="je@email.nl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {errors.email && <span className="dds-form-error">{errors.email}</span>}
        </div>

        <button
          className="dds-btn dds-btn-primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Bezig met boeken...' : (submitLabel || 'Bevestig afspraak')}
        </button>
      </div>
    </div>
  );
}
