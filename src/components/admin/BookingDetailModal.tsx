import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { Booking, Service, Staff } from '../../lib/types';

interface BookingDetailModalProps {
  booking: Booking | null;
  service: Service | null;
  staff: Staff | null;
  open: boolean;
  onClose: () => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    pending_payment: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-100 text-gray-700',
  };
  const labels: Record<string, string> = {
    confirmed: 'Bevestigd',
    pending_payment: 'Wacht op betaling',
    cancelled: 'Geannuleerd',
    no_show: 'No-show',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    none: 'bg-gray-100 text-gray-500',
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    refunded: 'bg-blue-100 text-blue-700',
    partially_paid: 'bg-orange-100 text-orange-700',
  };
  const labels: Record<string, string> = {
    none: 'Geen betaling',
    pending: 'In afwachting',
    paid: 'Betaald',
    failed: 'Mislukt',
    refunded: 'Terugbetaald',
    partially_paid: 'Deels betaald',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

export function BookingDetailModal({ booking, service, staff, open, onClose, onCancel, onNoShow }: BookingDetailModalProps) {
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'noshow' | null>(null);

  if (!booking) return null;

  const start = parseISO(booking.start_at);
  const end = parseISO(booking.end_at);
  const isActive = booking.status === 'confirmed' || booking.status === 'pending_payment';
  const hasPaid = booking.amount_paid_cents > 0;
  const totalCents = booking.amount_total_cents || (service?.price_cents || 0);
  const remainingCents = totalCents - (booking.amount_paid_cents || 0);

  const handleConfirmAction = () => {
    if (confirmAction === 'cancel') {
      onCancel(booking.id);
    } else if (confirmAction === 'noshow') {
      onNoShow(booking.id);
    }
    setConfirmAction(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Afspraak details">
      <div className="space-y-5">
        {/* Status row */}
        <div className="flex items-center gap-3">
          <StatusBadge status={booking.status} />
          {booking.payment_status !== 'none' && <PaymentBadge status={booking.payment_status} />}
        </div>

        {/* Date & time */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-lg font-semibold text-gray-900">
            {format(start, 'EEEE d MMMM yyyy', { locale: nl })}
          </div>
          <div className="text-gray-600 mt-1">
            {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Klant</label>
            <p className="text-sm font-semibold text-gray-900 mt-1">{booking.customer_name}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Telefoon</label>
            <p className="text-sm text-gray-900 mt-1">
              <a href={`tel:${booking.customer_phone}`} className="text-violet-600 hover:underline">{booking.customer_phone}</a>
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">E-mail</label>
            <p className="text-sm text-gray-900 mt-1">
              <a href={`mailto:${booking.customer_email}`} className="text-violet-600 hover:underline">{booking.customer_email}</a>
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Medewerker</label>
            <p className="text-sm font-semibold text-gray-900 mt-1">{staff?.name || '-'}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dienst</label>
            <p className="text-sm font-semibold text-gray-900 mt-1">{service?.name || '-'}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Duur</label>
            <p className="text-sm text-gray-900 mt-1">{service?.duration_min || '-'} min</p>
          </div>
        </div>

        {/* Payment info */}
        <div className="border-t pt-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Betaling</label>
          <div className="mt-2 bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Totaalprijs</span>
              <span className="font-semibold">{formatPrice(totalCents)}</span>
            </div>
            {booking.payment_type !== 'none' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{booking.payment_type === 'deposit' ? 'Aanbetaald' : 'Betaald'}</span>
                  <span className={`font-semibold ${hasPaid ? 'text-green-600' : 'text-yellow-600'}`}>
                    {formatPrice(booking.amount_paid_cents || 0)}
                  </span>
                </div>
                {booking.payment_type === 'deposit' && remainingCents > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Restbedrag</span>
                    <span className="font-semibold">{formatPrice(remainingCents)}</span>
                  </div>
                )}
              </>
            )}
            {booking.refund_status && booking.refund_status !== 'none' && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Terugbetaling</span>
                <span className="font-semibold text-blue-600">
                  {booking.refund_status === 'refunded' ? 'Terugbetaald' : booking.refund_status === 'pending' ? 'In behandeling' : 'Mislukt'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Booking ID */}
        <div className="text-xs text-gray-400">
          ID: {booking.id} · Aangemaakt: {format(parseISO(booking.created_at), 'dd-MM-yyyy HH:mm')}
        </div>

        {/* Actions */}
        {isActive && !confirmAction && (
          <div className="flex gap-3 border-t pt-4">
            <Button variant="danger" size="sm" onClick={() => setConfirmAction('cancel')}>
              Annuleren{hasPaid ? ' + terugbetalen' : ''}
            </Button>
            {booking.status === 'confirmed' && (
              <Button variant="secondary" size="sm" onClick={() => setConfirmAction('noshow')}>
                No-show
              </Button>
            )}
          </div>
        )}

        {/* Confirm action */}
        {confirmAction && (
          <div className="border-t pt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">
                {confirmAction === 'cancel'
                  ? hasPaid
                    ? `Weet je zeker? De aanbetaling van ${formatPrice(booking.amount_paid_cents || 0)} wordt terugbetaald via Mollie.`
                    : 'Weet je zeker dat je deze afspraak wilt annuleren?'
                  : 'Wil je deze klant als no-show markeren? De aanbetaling wordt niet terugbetaald.'}
              </p>
              <div className="flex gap-2 mt-3">
                <Button variant="danger" size="sm" onClick={handleConfirmAction}>
                  Ja, {confirmAction === 'cancel' ? 'annuleren' : 'no-show'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmAction(null)}>
                  Nee, terug
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
