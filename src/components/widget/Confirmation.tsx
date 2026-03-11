import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { nl } from 'date-fns/locale';
import { formatCents } from '../../lib/payment';
import type { Service, ServiceAddon, Staff, PaymentMode } from '../../lib/types';

interface ConfirmationProps {
  service: Service;
  staff: Staff;
  startAt: string;
  endAt: string;
  customerName: string;
  timezone: string;
  addons?: ServiceAddon[];
  totalCents?: number;
  depositPaidCents?: number;
  paymentMode?: PaymentMode;
}

export function Confirmation({
  service, staff, startAt, endAt, customerName, timezone,
  addons = [], totalCents,
  depositPaidCents = 0, paymentMode = 'none',
}: ConfirmationProps) {
  const start = toZonedTime(parseISO(startAt), timezone);
  const end = toZonedTime(parseISO(endAt), timezone);
  const computedTotal = totalCents ?? service.price_cents;
  const remainingCents = computedTotal - depositPaidCents;

  return (
    <div className="bellure-confirmation">
      <div className="bellure-confirmation-card">
        <div className="bellure-confirmation-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 className="bellure-confirmation-title">Afspraak bevestigd</h2>
        <p className="bellure-confirmation-text">
          Bedankt {customerName}! Je ontvangt een bevestiging per e-mail.
        </p>

        <div className="bellure-confirmation-summary">
          <div className="bellure-confirmation-row">
            <span className="bellure-confirmation-label">Behandeling</span>
            <span className="bellure-confirmation-value">{service.name}</span>
          </div>
          <div className="bellure-confirmation-row">
            <span className="bellure-confirmation-label">Medewerker</span>
            <span className="bellure-confirmation-value">{staff.name}</span>
          </div>
          <div className="bellure-confirmation-row">
            <span className="bellure-confirmation-label">Wanneer</span>
            <span className="bellure-confirmation-value bellure-confirmation-value--chips">
              <span className="bellure-confirmation-chip">{format(start, 'EEEE d MMMM yyyy', { locale: nl })}</span>
              <span className="bellure-confirmation-chip">{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</span>
            </span>
          </div>
          {addons.length > 0 && (
            <div className="bellure-confirmation-row">
              <span className="bellure-confirmation-label">Extra's</span>
              <span className="bellure-confirmation-value">{addons.map(a => a.name).join(', ')}</span>
            </div>
          )}
          <div className="bellure-confirmation-divider" />
          <div className="bellure-confirmation-total">
            <span className="bellure-confirmation-total-label">Totaal</span>
            <span className="bellure-confirmation-total-price">{formatCents(computedTotal)}</span>
          </div>

          {paymentMode === 'deposit' && depositPaidCents > 0 && (
            <>
              <div className="bellure-confirmation-divider" />
              <div className="bellure-confirmation-row bellure-confirmation-row--highlight">
                <span className="bellure-confirmation-label">Aanbetaald</span>
                <span className="bellure-confirmation-value bellure-confirmation-value--paid">{formatCents(depositPaidCents)}</span>
              </div>
              <div className="bellure-confirmation-row">
                <span className="bellure-confirmation-label">Restbedrag in salon</span>
                <span className="bellure-confirmation-value">{formatCents(remainingCents)}</span>
              </div>
            </>
          )}

          {(paymentMode === 'full' || paymentMode === 'optional') && depositPaidCents > 0 && (
            <>
              <div className="bellure-confirmation-divider" />
              <div className="bellure-confirmation-row bellure-confirmation-row--highlight">
                <span className="bellure-confirmation-label">Betaald</span>
                <span className="bellure-confirmation-value bellure-confirmation-value--paid">{formatCents(depositPaidCents)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
