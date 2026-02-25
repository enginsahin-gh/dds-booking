import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { nl } from 'date-fns/locale';

interface PaymentInfo {
  status: string;
  amount: number;
  currency: string;
  method: string | null;
  paidAt: string | null;
}

interface BookingInfo {
  id: string;
  start_at: string;
  end_at: string;
  customer_name: string;
  payment_status: string;
  services: { name: string; price_cents: number; duration_min: number } | null;
  staff: { name: string } | null;
}

interface PaymentStatusResponse {
  payment: PaymentInfo;
  booking: BookingInfo | null;
}

function formatPrice(euros: number): string {
  return `€${euros.toFixed(2).replace('.', ',')}`;
}

export function PaymentReturn() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const timezone = 'Europe/Amsterdam';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('booking_id');

    if (!bookingId) {
      setError('Geen boeking gevonden');
      setLoading(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/.netlify/functions/payment-status?booking_id=${bookingId}`);
        if (!res.ok) {
          if (res.status === 404) {
            // Payment might not be processed yet — retry a few times
            if (retryCount < 5) {
              setTimeout(() => setRetryCount((c) => c + 1), 2000);
              return;
            }
            setError('Betaling niet gevonden. Neem contact op met de salon.');
          } else {
            setError('Er ging iets mis bij het ophalen van de betaalstatus.');
          }
          setLoading(false);
          return;
        }

        const data: PaymentStatusResponse = await res.json();
        setPayment(data.payment);
        setBooking(data.booking);

        // If still open/pending, poll again (Mollie webhook might be slow)
        if (data.payment.status === 'open' && retryCount < 10) {
          setTimeout(() => setRetryCount((c) => c + 1), 3000);
          return;
        }

        setLoading(false);
      } catch {
        setError('Er ging iets mis. Probeer de pagina te vernieuwen.');
        setLoading(false);
      }
    };

    checkStatus();
  }, [retryCount]);

  if (loading) {
    return (
      <div className="dds-payment-return">
        <div className="dds-spinner">
          <div className="dds-spinner-circle" />
        </div>
        <p style={{ textAlign: 'center', marginTop: 16, color: '#6B7280' }}>
          Betaalstatus controleren...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dds-payment-return">
        <div className="dds-confirmation">
          <div className="dds-confirmation-icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h2 className="dds-confirmation-title">Er ging iets mis</h2>
          <p className="dds-confirmation-text">{error}</p>
        </div>
      </div>
    );
  }

  const isPaid = payment?.status === 'paid';

  if (isPaid && booking) {
    const start = toZonedTime(parseISO(booking.start_at), timezone);
    const end = toZonedTime(parseISO(booking.end_at), timezone);

    return (
      <div className="dds-payment-return">
        <div className="dds-confirmation">
          <div className="dds-confirmation-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="dds-confirmation-title">Betaling gelukt!</h2>
          <p className="dds-confirmation-text">
            Je afspraak is bevestigd, {booking.customer_name}. Je ontvangt een bevestiging per e-mail.
          </p>

          <div className="dds-summary-card" style={{ textAlign: 'left' }}>
            {booking.services && (
              <div className="dds-summary-row">
                <span className="dds-summary-label">Behandeling</span>
                <span className="dds-summary-value">{booking.services.name}</span>
              </div>
            )}
            {booking.staff && (
              <div className="dds-summary-row">
                <span className="dds-summary-label">Medewerker</span>
                <span className="dds-summary-value">{booking.staff.name}</span>
              </div>
            )}
            <div className="dds-summary-row">
              <span className="dds-summary-label">Datum</span>
              <span className="dds-summary-value">
                {format(start, 'EEEE d MMMM yyyy', { locale: nl })}
              </span>
            </div>
            <div className="dds-summary-row">
              <span className="dds-summary-label">Tijd</span>
              <span className="dds-summary-value">{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</span>
            </div>
            {payment && (
              <div className="dds-summary-row">
                <span className="dds-summary-label">Betaald</span>
                <span className="dds-summary-value">
                  {formatPrice(payment.amount)}
                  {payment.method && ` (${payment.method})`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Payment not successful
  return (
    <div className="dds-payment-return">
      <div className="dds-confirmation">
        <div className="dds-confirmation-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="dds-confirmation-title">Betaling niet gelukt</h2>
        <p className="dds-confirmation-text">
          {payment?.status === 'expired'
            ? 'De betaling is verlopen. Maak een nieuwe boeking om het opnieuw te proberen.'
            : payment?.status === 'canceled'
            ? 'De betaling is geannuleerd.'
            : 'De betaling is niet gelukt. Probeer het opnieuw of neem contact op met de salon.'}
        </p>
      </div>
    </div>
  );
}
