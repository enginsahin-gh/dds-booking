import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BookingWidget } from '../components/widget/BookingWidget';
import '../styles/widget.css';

export function BookingPage() {
  const { salonSlug } = useParams();
  const [params] = useSearchParams();
  const salon = salonSlug || params.get('salon') || '';
  const [slugInput, setSlugInput] = useState('');

  if (!salon) {
    return (
      <div className="bellure-booking-page">
        <div className="bellure-shadow-host" style={{ maxWidth: 520, margin: '0 auto', background: '#fff', borderRadius: 18, padding: 28, border: '1px solid #ECE7E2', boxShadow: '0 12px 30px rgba(0,0,0,0.06)' }}>
          <div className="bellure-step-title" style={{ marginBottom: 6 }}>Geen salon gevonden</div>
          <div className="bellure-step-subtitle" style={{ marginBottom: 18 }}>Vul je salonnaam in om te boeken.</div>
          <div className="bellure-login-form">
            <input
              className="bellure-form-input"
              placeholder="Bijv. salon-amara"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
            />
            <button
              className="bellure-btn bellure-btn-primary"
              onClick={() => {
                if (!slugInput.trim()) return;
                window.location.href = `/` + slugInput.trim();
              }}
            >
              Ga naar salon
            </button>
          </div>
          <div style={{ marginTop: 16, fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center' }}>
            Ben je salonhouder? <a href="https://mijn.bellure.nl/admin" style={{ color: '#1F2937', textDecoration: 'underline' }}>Log in hier</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bellure-booking-page">
      <div id="bellure-booking-widget" className="bellure-shadow-host">
        <BookingWidget salonSlug={salon} showSalonHeader />
      </div>
    </div>
  );
}
