import { useSearchParams } from 'react-router-dom';
import { BookingWidget } from '../components/widget/BookingWidget';
import '../styles/widget.css';

export function BookingPage() {
  const [params] = useSearchParams();
  const salon = params.get('salon');

  if (!salon) {
    return null;
  }

  return (
    <div className="bellure-booking-page">
      <div id="bellure-booking-widget" className="bellure-shadow-host">
        <BookingWidget salonSlug={salon} showSalonHeader />
      </div>
    </div>
  );
}
