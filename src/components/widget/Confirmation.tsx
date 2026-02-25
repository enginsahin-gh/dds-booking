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
    <div className="dds-confirmation">
      <div className="dds-confirmation-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="dds-confirmation-title">Afspraak bevestigd!</h2>
      <p className="dds-confirmation-text">
        Bedankt {customerName}! Je ontvangt een bevestiging per e-mail.
      </p>

      <div className="dds-summary-card" style={{ textAlign: 'left' }}>
        <div className="dds-summary-row">
          <span className="dds-summary-label">Behandeling</span>
          <span className="dds-summary-value">{service.name}</span>
        </div>
        <div className="dds-summary-row">
          <span className="dds-summary-label">Medewerker</span>
          <span className="dds-summary-value">{staff.name}</span>
        </div>
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
        <div className="dds-summary-row">
          <span className="dds-summary-label">Prijs</span>
          <span className="dds-summary-value">{formatCents(service.price_cents)}</span>
        </div>

        {paymentMode === 'deposit' && depositPaidCents > 0 && (
          <>
            <div className="dds-summary-divider" />
            <div className="dds-summary-row dds-summary-row--highlight">
              <span className="dds-summary-label">Aanbetaald</span>
              <span className="dds-summary-value dds-summary-value--paid">{formatCents(depositPaidCents)}</span>
            </div>
            <div className="dds-summary-row">
              <span className="dds-summary-label">Restbedrag in salon</span>
              <span className="dds-summary-value">{formatCents(remainingCents)}</span>
            </div>
          </>
        )}

        {paymentMode === 'full' && depositPaidCents > 0 && (
          <>
            <div className="dds-summary-divider" />
            <div className="dds-summary-row dds-summary-row--highlight">
              <span className="dds-summary-label">Betaald</span>
              <span className="dds-summary-value dds-summary-value--paid">{formatCents(depositPaidCents)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
