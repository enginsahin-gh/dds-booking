import { useSearchParams, Navigate } from 'react-router-dom';
import { BookingWidget } from '../components/widget/BookingWidget';

export function BookingPage() {
  const [params] = useSearchParams();
  const salon = params.get('salon');

  // No salon specified → redirect to demo salon
  if (!salon) {
    return <Navigate to="/?salon=salon-amara" replace />;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>
      <BookingWidget salonSlug={salon} />
    </div>
  );
}
