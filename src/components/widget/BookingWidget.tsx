import { useState, useEffect, useCallback } from 'react';
import { addMinutes } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { calculateDepositCents, requiresPayment, formatCents } from '../../lib/payment';
import { StepIndicator } from './StepIndicator';
import { ServicePicker } from './ServicePicker';
import { StaffPicker } from './StaffPicker';
import { DateTimePicker } from './DateTimePicker';
import { CustomerForm } from './CustomerForm';
import { PaymentStep } from './PaymentStep';
import { Confirmation } from './Confirmation';
import { useSlots } from '../../hooks/useSlots';
import type { Salon, Service, Staff, TimeSlot, BookingStep } from '../../lib/types';

interface BookingWidgetProps {
  salonSlug: string;
}

const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_URL || '';

export function BookingWidget({ salonSlug }: BookingWidgetProps) {
  const [step, setStep] = useState<BookingStep>(1);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selections
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffConfirmed, setStaffConfirmed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Payment
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Customer data (stored between steps)
  const [customerData, setCustomerData] = useState<{ name: string; email: string; phone: string } | null>(null);

  // Confirmation data
  const [confirmedStaff, setConfirmedStaff] = useState<Staff | null>(null);
  const [confirmedStartAt, setConfirmedStartAt] = useState('');
  const [confirmedEndAt, setConfirmedEndAt] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [depositPaidCents, setDepositPaidCents] = useState(0);

  const timezone = salon?.timezone || 'Europe/Amsterdam';

  // Slots
  const { slots, loading: slotsLoading } = useSlots(
    selectedDate,
    selectedService?.duration_min || 0,
    staff,
    staffConfirmed ? selectedStaffId : null,
    timezone
  );

  // Load salon data
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: salonData, error: salonErr } = await supabase
        .from('salons')
        .select('*')
        .eq('slug', salonSlug)
        .single();

      if (salonErr || !salonData) {
        setError('Dit boekingssysteem is niet beschikbaar');
        setLoading(false);
        return;
      }

      setSalon(salonData);

      const [servicesRes, staffRes] = await Promise.all([
        supabase.from('services').select('*').eq('salon_id', salonData.id).eq('is_active', true).order('sort_order'),
        supabase.from('staff').select('*').eq('salon_id', salonData.id).eq('is_active', true).order('sort_order'),
      ]);

      setServices(servicesRes.data || []);
      setStaff(staffRes.data || []);
      setLoading(false);
    };

    init();
  }, [salonSlug]);

  // Scroll to top of widget on step change
  const scrollToWidget = useCallback(() => {
    const el = document.getElementById('dds-booking-widget') || document.querySelector('[id^="dds-booking-widget"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const goToStep = useCallback((s: BookingStep) => {
    setStep(s);
    setTimeout(scrollToWidget, 100);
  }, [scrollToWidget]);

  const handleServiceSelect = useCallback((service: Service) => {
    setSelectedService(service);
    goToStep(2);
  }, [goToStep]);

  const handleStaffSelect = useCallback((staffId: string | null) => {
    setSelectedStaffId(staffId);
    setStaffConfirmed(true);
    goToStep(3);
  }, [goToStep]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  }, []);

  const handleSlotSelect = useCallback((slot: TimeSlot) => {
    setSelectedSlot(slot);
    goToStep(4);
  }, [goToStep]);

  const handleBack = useCallback(() => {
    if (step === 5) {
      // From payment back to form
      goToStep(4);
    } else if (step > 1) {
      goToStep((step - 1) as BookingStep);
    }
  }, [step, goToStep]);

  // Create booking (called from CustomerForm submit)
  const handleBooking = useCallback(async (data: { name: string; email: string; phone: string; hp?: string }) => {
    if (!salon || !selectedService || !selectedSlot) return;

    setBookingLoading(true);
    setBookingError(null);
    setCustomerData(data);

    const startAt = selectedSlot.time;
    const endAt = addMinutes(new Date(startAt), selectedService.duration_min).toISOString();
    const needsPayment = requiresPayment(salon);
    const depositCents = calculateDepositCents(salon, selectedService.price_cents);

    try {
      // Insert booking — status depends on payment mode
      const bookingStatus = needsPayment ? 'pending_payment' : 'confirmed';
      const paymentType = salon.payment_mode === 'none' ? 'none' : salon.payment_mode;

      const { data: bookingData, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          salon_id: salon.id,
          service_id: selectedService.id,
          staff_id: selectedSlot.staffId,
          start_at: startAt,
          end_at: endAt,
          customer_name: data.name,
          customer_email: data.email,
          customer_phone: data.phone,
          status: bookingStatus,
          payment_type: paymentType,
          payment_status: needsPayment ? 'pending' : 'none',
          amount_total_cents: selectedService.price_cents,
          amount_paid_cents: 0,
          amount_due_cents: needsPayment ? depositCents : 0,
        })
        .select('id')
        .single();

      if (bookingErr) {
        if (bookingErr.code === '23505') {
          setBookingError('Dit tijdslot is zojuist geboekt. Kies een ander tijdstip.');
          goToStep(3);
        } else {
          setBookingError('Er ging iets mis. Probeer het opnieuw.');
        }
        setBookingLoading(false);
        return;
      }

      const bookedStaff = staff.find((s) => s.id === selectedSlot.staffId) || null;
      setConfirmedStaff(bookedStaff);
      setConfirmedStartAt(startAt);
      setConfirmedEndAt(endAt);
      setCustomerName(data.name);
      setBookingId(bookingData.id);

      if (needsPayment) {
        // Go to payment step
        setDepositPaidCents(depositCents);
        goToStep(5);
      } else {
        // No payment needed — confirm directly
        setDepositPaidCents(0);
        goToStep(6);
      }
    } catch {
      setBookingError('Er ging iets mis. Probeer het opnieuw.');
    }

    setBookingLoading(false);
  }, [salon, selectedService, selectedSlot, staff, goToStep]);

  // Initiate Mollie payment
  const handlePayment = useCallback(async () => {
    if (!salon || !selectedService || !bookingId) return;

    setPaymentLoading(true);
    setPaymentError(null);

    const depositCents = calculateDepositCents(salon, selectedService.price_cents);
    const isDeposit = salon.payment_mode === 'deposit';
    const description = isDeposit
      ? `Aanbetaling: ${selectedService.name} bij ${salon.name}`
      : `${selectedService.name} bij ${salon.name}`;

    // Build redirect URL — return to the widget page with booking_id
    const currentUrl = window.location.href.split('?')[0];
    const redirectUrl = `${currentUrl}?payment_return=1&booking_id=${bookingId}`;

    try {
      const res = await fetch(`${FUNCTIONS_BASE}/.netlify/functions/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          amount: depositCents,
          description,
          redirectUrl,
          salonSlug: salon.slug,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setPaymentError(errData.error || 'Betaling kon niet worden gestart. Probeer het opnieuw.');
        setPaymentLoading(false);
        return;
      }

      const { checkoutUrl } = await res.json();
      if (checkoutUrl) {
        // Redirect to Mollie checkout
        window.location.href = checkoutUrl;
      } else {
        setPaymentError('Geen betaallink ontvangen. Probeer het opnieuw.');
        setPaymentLoading(false);
      }
    } catch {
      setPaymentError('Er ging iets mis. Probeer het opnieuw.');
      setPaymentLoading(false);
    }
  }, [salon, selectedService, bookingId]);

  // Loading state
  if (loading) {
    return (
      <div className="dds-spinner">
        <div className="dds-spinner-circle" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="dds-error">
        <p className="dds-error-title">{error}</p>
      </div>
    );
  }

  if (!services.length || !staff.length) {
    return (
      <div className="dds-error">
        <p className="dds-error-title">Er zijn momenteel geen diensten beschikbaar</p>
      </div>
    );
  }

  // Calculate deposit for display in step 4 summary
  const depositCents = salon && selectedService
    ? calculateDepositCents(salon, selectedService.price_cents)
    : 0;
  const needsPayment = salon ? requiresPayment(salon) : false;

  return (
    <div>
      <StepIndicator currentStep={step} totalSteps={needsPayment ? 6 : 5} />

      {bookingError && step < 5 && (
        <div style={{ padding: '8px 16px', marginBottom: 12, background: '#FEF2F2', borderRadius: 8, color: '#DC2626', fontSize: '0.875rem', textAlign: 'center' }}>
          {bookingError}
        </div>
      )}

      {step === 1 && (
        <ServicePicker
          services={services}
          selectedId={selectedService?.id || null}
          onSelect={handleServiceSelect}
        />
      )}

      {step === 2 && (
        <div>
          <StaffPicker staff={staff} selectedId={selectedStaffId} onSelect={handleStaffSelect} />
          <div className="dds-btn-group">
            <button className="dds-btn dds-btn-secondary" onClick={handleBack}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/></svg> Terug</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <DateTimePicker
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSlotSelect}
            slots={slots}
            slotsLoading={slotsLoading}
            timezone={timezone}
          />
          <div className="dds-btn-group">
            <button className="dds-btn dds-btn-secondary" onClick={handleBack}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/></svg> Terug</button>
            {selectedSlot && (
              <button className="dds-btn dds-btn-primary" onClick={() => goToStep(4)}>
                Verder <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="5 12 19 12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          {/* Booking summary */}
          {selectedService && selectedSlot && (
            <div className="dds-summary" style={{ marginBottom: 20 }}>
              <h2 className="dds-step-title">Jouw afspraak</h2>
              <p className="dds-step-subtitle">Controleer je gegevens en bevestig</p>
              <div className="dds-summary-card">
                <div className="dds-summary-row">
                  <span className="dds-summary-label">Behandeling</span>
                  <span className="dds-summary-value">{selectedService.name}</span>
                </div>
                <div className="dds-summary-row">
                  <span className="dds-summary-label">Duur</span>
                  <span className="dds-summary-value">{selectedService.duration_min} min</span>
                </div>
                <div className="dds-summary-row">
                  <span className="dds-summary-label">Prijs</span>
                  <span className="dds-summary-value">{formatCents(selectedService.price_cents)}</span>
                </div>
                <div className="dds-summary-row">
                  <span className="dds-summary-label">Stylist</span>
                  <span className="dds-summary-value">{staff.find(s => s.id === selectedSlot.staffId)?.name || 'Geen voorkeur'}</span>
                </div>
                <div className="dds-summary-row">
                  <span className="dds-summary-label">Datum</span>
                  <span className="dds-summary-value">{new Date(selectedSlot.time).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </div>
                <div className="dds-summary-row">
                  <span className="dds-summary-label">Tijd</span>
                  <span className="dds-summary-value">{new Date(selectedSlot.time).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}</span>
                </div>
                {needsPayment && (
                  <div className="dds-summary-row dds-summary-row--highlight">
                    <span className="dds-summary-label">
                      {salon?.payment_mode === 'deposit' ? 'Aanbetaling' : 'Te betalen'}
                    </span>
                    <span className="dds-summary-value dds-summary-value--price">
                      {formatCents(depositCents)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          <CustomerForm
            onSubmit={handleBooking}
            loading={bookingLoading}
            submitLabel={needsPayment ? 'Verder naar betaling' : 'Bevestig afspraak'}
          />
          <div className="dds-btn-group" style={{ marginTop: 8 }}>
            <button className="dds-btn dds-btn-secondary" onClick={handleBack}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/></svg> Terug</button>
          </div>
        </div>
      )}

      {step === 5 && salon && selectedService && selectedSlot && (
        <div>
          <PaymentStep
            salon={salon}
            service={selectedService}
            staff={confirmedStaff}
            slot={selectedSlot}
            depositCents={depositPaidCents}
            totalCents={selectedService.price_cents}
            customerName={customerName}
            timezone={timezone}
            onPay={handlePayment}
            loading={paymentLoading}
            error={paymentError}
          />
          <div className="dds-btn-group" style={{ marginTop: 8 }}>
            <button className="dds-btn dds-btn-secondary" onClick={handleBack} disabled={paymentLoading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/></svg> Terug
            </button>
          </div>
        </div>
      )}

      {step === 6 && selectedService && confirmedStaff && (
        <Confirmation
          service={selectedService}
          staff={confirmedStaff}
          startAt={confirmedStartAt}
          endAt={confirmedEndAt}
          customerName={customerName}
          timezone={timezone}
          depositPaidCents={depositPaidCents}
          paymentMode={salon?.payment_mode || 'none'}
        />
      )}
    </div>
  );
}
