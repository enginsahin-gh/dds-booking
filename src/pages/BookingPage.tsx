import { useSearchParams } from 'react-router-dom';
import { BookingWidget } from '../components/widget/BookingWidget';

export function BookingPage() {
  const [params] = useSearchParams();
  const salon = params.get('salon');

  if (!salon) {
    return null;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>
      <BookingWidget salonSlug={salon} />
    </div>
  );
}
