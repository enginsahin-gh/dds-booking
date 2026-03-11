import { useParams, useSearchParams } from 'react-router-dom';
import { BookingWidget } from '../components/widget/BookingWidget';
import '../styles/widget.css';

export function BookingPage() {
  const { salonSlug } = useParams();
  const [params] = useSearchParams();
  const salon = salonSlug || params.get('salon') || '';
  if (!salon) {
    return (
      <main className="bellure-booking-page">
        <div className="bellure-shadow-host" style={{ maxWidth: 520, margin: '0 auto', background: '#fff', borderRadius: 18, padding: 28, border: '1px solid #ECE7E2', boxShadow: '0 12px 30px rgba(0,0,0,0.06)' }}>
          <div className="bellure-step-title" style={{ marginBottom: 6 }}>Geen salon gekozen</div>
          <div className="bellure-step-subtitle" style={{ marginBottom: 18 }}>Gebruik de boekingslink die je van je salon hebt ontvangen.</div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center' }}>
            Ben je salonhouder? <a href="https://mijn.bellure.nl/admin" style={{ color: '#1F2937', textDecoration: 'underline' }}>Log in hier</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bellure-booking-page">
      <div id="bellure-booking-widget" className="bellure-shadow-host">
        <BookingWidget salonSlug={salon} showSalonHeader />
      </div>
    </main>
  );
}
