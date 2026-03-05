import { useParams, useSearchParams } from 'react-router-dom';
import { BookingWidget } from '../components/widget/BookingWidget';
import '../styles/widget.css';

export function BookingPage() {
  const { salonSlug } = useParams();
  const [params] = useSearchParams();
  const salon = salonSlug || params.get('salon') || '';

  if (!salon) {
    return (
      <div style={{ maxWidth: '520px', margin: '4rem auto', textAlign: 'center', color: '#6B7280' }}>
        Geen salon gevonden. Controleer de link.
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
