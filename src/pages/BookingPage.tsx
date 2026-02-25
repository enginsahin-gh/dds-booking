import { useSearchParams } from 'react-router-dom';
import { BookingWidget } from '../components/widget/BookingWidget';

export function BookingPage() {
  const [params] = useSearchParams();
  const salon = params.get('salon');

  if (!salon) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#666' }}>
        <p>Geen salon opgegeven. Gebruik: ?salon=naam</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>
      <BookingWidget salonSlug={salon} />
    </div>
  );
}
