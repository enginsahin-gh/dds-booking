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
    <div className="bellure-animate-in">
      <div className="bellure-form">
        {/* Honeypot field — invisible to humans */}
        <div className="bellure-form-hp" aria-hidden="true">
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

        <button
          className="bellure-btn bellure-btn-primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Bezig met boeken...' : (submitLabel || 'Bevestig afspraak')}
        </button>
      </div>
    </div>
  );
}
