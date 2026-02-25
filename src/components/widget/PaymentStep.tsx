import { useState } from 'react';
import { formatCents } from '../../lib/payment';
import type { Salon, Service, Staff, TimeSlot } from '../../lib/types';

interface PaymentStepProps {
  salon: Salon;
  service: Service;
  staff: Staff | null;
  slot: TimeSlot;
  depositCents: number;
  totalCents: number;
  customerName: string;
  timezone: string;
  onPay: () => void;
  loading: boolean;
  error: string | null;
}

export function PaymentStep({
  salon,
  service,
  staff,
  slot,
  depositCents,
  totalCents,
  customerName,
  timezone,
  onPay,
  loading,
  error,
}: PaymentStepProps) {
  const isDeposit = salon.payment_mode === 'deposit';
  const remainingCents = totalCents - depositCents;

  const startDate = new Date(slot.time);
  const dateStr = startDate.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  });
  const timeStr = startDate.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });

  return (
    <div className="dds-animate-in">
      <div className="dds-payment-step">
        <div className="dds-payment-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>

        <h2 className="dds-step-title">
          {isDeposit ? 'Aanbetaling voldoen' : 'Betaling voldoen'}
        </h2>
        <p className="dds-step-subtitle">
          {isDeposit
            ? `Betaal ${formatCents(depositCents)} als aanbetaling om je afspraak te bevestigen.`
            : `Betaal ${formatCents(totalCents)} om je afspraak te bevestigen.`}
        </p>

        <div className="dds-payment-breakdown">
          <div className="dds-payment-breakdown-row">
            <span>{service.name}</span>
            <span>{formatCents(totalCents)}</span>
          </div>
          {isDeposit && (
            <>
              <div className="dds-payment-breakdown-divider" />
              <div className="dds-payment-breakdown-row dds-payment-breakdown-highlight">
                <span>Aanbetaling nu</span>
                <span>{formatCents(depositCents)}</span>
              </div>
              <div className="dds-payment-breakdown-row dds-payment-breakdown-remaining">
                <span>Restbedrag in de salon</span>
                <span>{formatCents(remainingCents)}</span>
              </div>
            </>
          )}
        </div>

        <div className="dds-payment-details">
          <div className="dds-payment-detail-row">
            <span className="dds-payment-detail-label">Klant</span>
            <span className="dds-payment-detail-value">{customerName}</span>
          </div>
          <div className="dds-payment-detail-row">
            <span className="dds-payment-detail-label">Datum</span>
            <span className="dds-payment-detail-value">{dateStr}</span>
          </div>
          <div className="dds-payment-detail-row">
            <span className="dds-payment-detail-label">Tijd</span>
            <span className="dds-payment-detail-value">{timeStr}</span>
          </div>
          {staff && (
            <div className="dds-payment-detail-row">
              <span className="dds-payment-detail-label">Medewerker</span>
              <span className="dds-payment-detail-value">{staff.name}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="dds-payment-error">
            {error}
          </div>
        )}

        <button
          className="dds-btn dds-btn-primary dds-btn-pay"
          onClick={onPay}
          disabled={loading}
        >
          {loading ? (
            <span className="dds-btn-loading">
              <span className="dds-btn-spinner" />
              Even geduld...
            </span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', marginRight: 8 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {isDeposit ? `Betaal ${formatCents(depositCents)}` : `Betaal ${formatCents(totalCents)}`}
            </>
          )}
        </button>

        <p className="dds-payment-secure">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: 4 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Veilig betalen via iDEAL, creditcard of andere methoden
        </p>

        {isDeposit && (
          <p className="dds-payment-note">
            Het restbedrag van {formatCents(remainingCents)} betaal je bij je bezoek aan de salon.
          </p>
        )}
      </div>
    </div>
  );
}
