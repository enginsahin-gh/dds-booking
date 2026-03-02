import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import type { Booking, Service, Staff } from '../../lib/types';

interface BookingService {
  service_id: string;
  price_cents: number;
  duration_min: number;
  service_name?: string;
}

interface BookingDetailModalProps {
  booking: Booking | null;
  service: Service | null;
  staff: Staff | null;
  allServices?: Service[];
  open: boolean;
  onClose: () => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
  onComplete: (id: string) => void;
  canEdit?: boolean;
  canSeeRevenue?: boolean;
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-emerald-50 text-emerald-700',
    pending_payment: 'bg-amber-50 text-amber-700',
    cancelled: 'bg-red-50 text-red-700',
    no_show: 'bg-gray-100 text-gray-600',
    completed: 'bg-blue-50 text-blue-700',
  };
  const labels: Record<string, string> = {
    confirmed: 'Bevestigd',
    pending_payment: 'Wacht op betaling',
    cancelled: 'Geannuleerd',
    no_show: 'No-show',
    completed: 'Voltooid',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    none: 'bg-gray-100 text-gray-500',
    pending: 'bg-amber-50 text-amber-700',
    paid: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700',
    refunded: 'bg-blue-50 text-blue-700',
    partially_paid: 'bg-orange-50 text-orange-700',
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

export function BookingDetailModal({ booking, service, staff, allServices, open, onClose, onCancel, onNoShow, onComplete, canEdit = true, canSeeRevenue = true }: BookingDetailModalProps) {
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'noshow' | 'complete' | null>(null);
  const [bookingServices, setBookingServices] = useState<BookingService[]>([]);

  // Fetch booking_services when modal opens
  useEffect(() => {
    if (!booking || !open) {
      setBookingServices([]);
      return;
    }
    supabase
      .from('booking_services')
      .select('service_id, price_cents, duration_min')
      .eq('booking_id', booking.id)
      .order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Resolve service names
          const enriched = data.map(bs => ({
            ...bs,
            service_name: allServices?.find(s => s.id === bs.service_id)?.name
              || undefined,
          }));
          setBookingServices(enriched);
        } else {
          setBookingServices([]);
        }
      });
  }, [booking?.id, open]);

  if (!booking) return null;

  const start = parseISO(booking.start_at);
  const end = parseISO(booking.end_at);
  const isActive = booking.status === 'confirmed' || booking.status === 'pending_payment';
  const hasPaid = booking.amount_paid_cents > 0;
  const totalCents = booking.amount_total_cents || (service?.price_cents || 0);
  const remainingCents = totalCents - (booking.amount_paid_cents || 0);
  const isMultiService = bookingServices.length > 1;

  const handleConfirmAction = () => {
    if (confirmAction === 'cancel') onCancel(booking.id);
    else if (confirmAction === 'noshow') onNoShow(booking.id);
    else if (confirmAction === 'complete') onComplete(booking.id);
    setConfirmAction(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={() => { setConfirmAction(null); onClose(); }} title="Afspraak details">
      <div className="space-y-5">
        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={booking.status} />
          {booking.payment_status !== 'none' && <PaymentBadge status={booking.payment_status} />}
        </div>

        {/* Date & time card */}
        <div className="bg-violet-50/50 rounded-xl p-4 border border-violet-100/50">
          <div className="text-[15px] font-bold text-gray-900">
            {format(start, 'EEEE d MMMM yyyy', { locale: nl })}
          </div>
          <div className="text-[14px] text-violet-700 font-semibold mt-1">
            {format(start, 'HH:mm')} — {format(end, 'HH:mm')}
          </div>
        </div>

        {/* Customer info */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Klant</div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-[13px] text-gray-500">Naam</span>
              <span className="text-[14px] font-semibold text-gray-900">{booking.customer_name}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-[13px] text-gray-500">Telefoon</span>
              <a href={`tel:${booking.customer_phone}`} className="text-[14px] font-medium text-violet-600 hover:text-violet-800 transition-colors flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                {booking.customer_phone}
              </a>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-[13px] text-gray-500">E-mail</span>
              <a href={`mailto:${booking.customer_email}`} className="text-[14px] font-medium text-violet-600 hover:text-violet-800 transition-colors truncate max-w-[200px]">
                {booking.customer_email}
              </a>
            </div>
          </div>
        </div>

        {/* Services */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {isMultiService ? 'Behandelingen' : 'Behandeling'}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {isMultiService ? (
              bookingServices.map((bs, idx) => (
                <div key={idx} className="flex justify-between items-center px-4 py-3">
                  <div>
                    <div className="text-[14px] font-semibold text-gray-900">{bs.service_name || 'Onbekend'}</div>
                    <div className="text-[12px] text-gray-400">{bs.duration_min} min</div>
                  </div>
                  {canSeeRevenue && <span className="text-[14px] font-semibold text-gray-900">{formatPrice(bs.price_cents)}</span>}
                </div>
              ))
            ) : (
              <div className="flex justify-between items-center px-4 py-3">
                <div>
                  <div className="text-[14px] font-semibold text-gray-900">{service?.name || '-'}</div>
                  <div className="text-[12px] text-gray-400">{service?.duration_min || '-'} min</div>
                </div>
                {canSeeRevenue && <span className="text-[14px] font-semibold text-gray-900">{formatPrice(service?.price_cents || 0)}</span>}
              </div>
            )}
            {/* Staff */}
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-[13px] text-gray-500">Medewerker</span>
              <span className="text-[14px] font-semibold text-gray-900">{staff?.name || '-'}</span>
            </div>
          </div>
        </div>

        {/* Payment info — only visible if canSeeRevenue */}
        {canSeeRevenue && (
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Betaling</div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-[13px] text-gray-500">Totaalprijs</span>
                <span className="text-[14px] font-bold text-gray-900">{formatPrice(totalCents)}</span>
              </div>
              {booking.payment_type !== 'none' && (
                <>
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-[13px] text-gray-500">{booking.payment_type === 'deposit' ? 'Aanbetaald' : 'Betaald'}</span>
                    <span className={`text-[14px] font-bold ${hasPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatPrice(booking.amount_paid_cents || 0)}
                    </span>
                  </div>
                  {booking.payment_type === 'deposit' && remainingCents > 0 && (
                    <div className="flex justify-between items-center px-4 py-3">
                      <span className="text-[13px] text-gray-500">Restbedrag in salon</span>
                      <span className="text-[14px] font-bold text-gray-900">{formatPrice(remainingCents)}</span>
                    </div>
                  )}
                </>
              )}
              {booking.refund_status && booking.refund_status !== 'none' && (
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-[13px] text-gray-500">Terugbetaling</span>
                  <span className="text-[14px] font-bold text-blue-600">
                    {booking.refund_status === 'refunded' ? 'Terugbetaald' : booking.refund_status === 'pending' ? 'In behandeling' : 'Mislukt'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Booking ID */}
        <div className="text-[11px] text-gray-400">
          ID: <span className="font-mono">{booking.id.slice(0, 8)}</span> · Aangemaakt: {format(parseISO(booking.created_at), 'dd-MM-yyyy HH:mm')}
        </div>

        {/* Actions */}
        {canEdit && isActive && !confirmAction && (
          <div className="flex gap-2 flex-wrap border-t border-gray-100 pt-4">
            {booking.status === 'confirmed' && (
              <Button size="sm" onClick={() => setConfirmAction('complete')}>
                <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                Voltooid
              </Button>
            )}
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
          <div className="border-t border-gray-100 pt-4">
            <div className={`${confirmAction === 'complete' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'} border rounded-xl p-4`}>
              <p className={`text-[13px] font-medium ${confirmAction === 'complete' ? 'text-blue-800' : 'text-red-800'}`}>
                {confirmAction === 'complete'
                  ? 'Afspraak markeren als voltooid?'
                  : confirmAction === 'cancel'
                    ? hasPaid
                      ? `Weet je zeker? De aanbetaling van ${formatPrice(booking.amount_paid_cents || 0)} wordt terugbetaald via Mollie.`
                      : 'Weet je zeker dat je deze afspraak wilt annuleren?'
                    : 'Wil je deze klant als no-show markeren? De aanbetaling wordt niet terugbetaald.'}
              </p>
              <div className="flex gap-2 mt-3">
                <Button variant={confirmAction === 'complete' ? 'primary' : 'danger'} size="sm" onClick={handleConfirmAction}>
                  Ja, {confirmAction === 'complete' ? 'voltooid' : confirmAction === 'cancel' ? 'annuleren' : 'no-show'}
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
