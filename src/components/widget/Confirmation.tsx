import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { nl } from 'date-fns/locale';
import { formatCents } from '../../lib/payment';
import type { Service, Staff, PaymentMode } from '../../lib/types';

interface ConfirmationProps {
  service: Service;
  staff: Staff;
  startAt: string;
  endAt: string;
  customerName: string;
  timezone: string;
  depositPaidCents?: number;
  paymentMode?: PaymentMode;
}

export function Confirmation({
  service, staff, startAt, endAt, customerName, timezone,
  depositPaidCents = 0, paymentMode = 'none',
}: ConfirmationProps) {
  const start = toZonedTime(parseISO(startAt), timezone);
  const end = toZonedTime(parseISO(endAt), timezone);
  const remainingCents = service.price_cents - depositPaidCents;

  return (
    <div className="bellure-confirmation">
      <div className="bellure-confirmation-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="bellure-confirmation-title">Afspraak bevestigd!</h2>
      <p className="bellure-confirmation-text">
        Bedankt {customerName}! Je ontvangt een bevestiging per e-mail.
      </p>

      <div className="bellure-summary-card" style={{ textAlign: 'left' }}>
        <div className="bellure-summary-row">
          <span className="bellure-summary-label">Behandeling</span>
          <span className="bellure-summary-value">{service.name}</span>
        </div>
        <div className="bellure-summary-row">
          <span className="bellure-summary-label">Medewerker</span>
          <span className="bellure-summary-value">{staff.name}</span>
        </div>
        <div className="bellure-summary-row">
          <span className="bellure-summary-label">Datum</span>
          <span className="bellure-summary-value">
            {format(start, 'EEEE d MMMM yyyy', { locale: nl })}
          </span>
        </div>
        <div className="bellure-summary-row">
          <span className="bellure-summary-label">Tijd</span>
          <span className="bellure-summary-value">{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</span>
        </div>
        <div className="bellure-summary-row">
          <span className="bellure-summary-label">Prijs</span>
          <span className="bellure-summary-value">{formatCents(service.price_cents)}</span>
        </div>

        {paymentMode === 'deposit' && depositPaidCents > 0 && (
          <>
            <div className="bellure-summary-divider" />
            <div className="bellure-summary-row bellure-summary-row--highlight">
              <span className="bellure-summary-label">Aanbetaald</span>
              <span className="bellure-summary-value bellure-summary-value--paid">{formatCents(depositPaidCents)}</span>
            </div>
            <div className="bellure-summary-row">
              <span className="bellure-summary-label">Restbedrag in salon</span>
              <span className="bellure-summary-value">{formatCents(remainingCents)}</span>
            </div>
          </>
        )}

        {paymentMode === 'full' && depositPaidCents > 0 && (
          <>
            <div className="bellure-summary-divider" />
            <div className="bellure-summary-row bellure-summary-row--highlight">
              <span className="bellure-summary-label">Betaald</span>
              <span className="bellure-summary-value bellure-summary-value--paid">{formatCents(depositPaidCents)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
